'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Container, ExerciseInstruction, ExerciseWithAnswers } from '@/features/content/types';
import {
  fromPersisted,
  TEMPLATE_CODE,
  toContent,
  toExpectedAnswers,
  type WordBankGapFill,
} from '@/lib/shared-kernel/wordbank-gapfill';
import {
  fromPersisted as errorCorrectionFromPersisted,
  TEMPLATE_CODE as ERROR_CORRECTION_TEMPLATE_CODE,
  toContent as errorCorrectionToContent,
  toExpectedAnswers as errorCorrectionToExpectedAnswers,
  type ErrorCorrection,
} from '@/lib/shared-kernel/error-correction';
import type { MaterialKind } from '@/lib/content/lesson-types';

import { exerciseFormSchema, type ExerciseFormValues } from '../schemas/exercise';
import { DEFAULT_EXERCISE_VALUES, parseExerciseToForm } from '../lib/exercise-content';
import { updateExerciseAction } from '../actions/exercise';
import { useAuthoringExercise } from '../api/use-authoring-exercises';
import { authoringKeys } from '../api/keys';
import { LessonEditorShell } from './lesson-editor-shell';
import { ExerciseFields } from './exercise-fields';
import { GapFillBuilder } from './wordbank-gapfill/builder';
import type { SavedDocument } from './wordbank-gapfill/use-gap-fill-autosave';
import { GapFillPreview } from './wordbank-gapfill/gap-fill-preview';
import { ErrorCorrectionBuilder } from './error-correction/builder';
import { ErrorCorrectionPreview } from './error-correction/error-correction-preview';
import { ExerciseLessonPreview } from './exercise-lesson-preview';

interface ExerciseEditorPaneProps {
  kind: MaterialKind;
  exerciseId: string;
  lessonTitle: string | null;
  state: 'draft' | 'published' | null;
  /** Whether students can open this material right now — see `SaveScopeContext`. */
  isLive: boolean | null;
  container: Container;
  backHref: string;
  publishSlot: ReactNode;
}

export function ExerciseEditorPane({
  kind,
  exerciseId,
  lessonTitle,
  state,
  isLive,
  container,
  backHref,
  publishSlot,
}: ExerciseEditorPaneProps) {
  const t = useTranslations('Authoring');
  const queryClient = useQueryClient();
  const { data: exercise, isLoading } = useAuthoringExercise(exerciseId);
  const initialValues = exercise ? parseExerciseToForm(exercise) : DEFAULT_EXERCISE_VALUES;
  const [previewValues, setPreviewValues] = useState<ExerciseFormValues>(initialValues);
  /** The gap-fill document as the builder currently has it, for the preview column. */
  const [gapFill, setGapFill] = useState<{
    exercise: WordBankGapFill;
    instructions: string;
  } | null>(null);
  /** The error-correction document as its builder currently has it, for the preview column. */
  const [errorCorrection, setErrorCorrection] = useState<ErrorCorrection | null>(null);

  const isGapFill = exercise?.templateCode === TEMPLATE_CODE;
  const isErrorCorrection = exercise?.templateCode === ERROR_CORRECTION_TEMPLATE_CODE;

  return (
    <LessonEditorShell
      kind={kind}
      title={lessonTitle || t('lessons.untitled')}
      state={state}
      isLive={isLive}
      // An exercise document waits in its draft whatever its placement says.
      savesHeldForPublish
      backHref={backHref}
      saveStatus="idle"
      savedAt={null}
      publishSlot={publishSlot}
      preview={
        isGapFill && gapFill !== null ? (
          <GapFillPreview exercise={gapFill.exercise} instructions={gapFill.instructions} />
        ) : isErrorCorrection && errorCorrection !== null ? (
          <ErrorCorrectionPreview exercise={errorCorrection} />
        ) : (
          <ExerciseLessonPreview title={lessonTitle ?? ''} values={previewValues} />
        )
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : isGapFill ? (
        // Gap-fill has its own three-step builder rather than a slice of the generic
        // exercise form: its answers live inside the sentences, so authoring them means
        // editing the document the kernel defines, not a set of fields.
        <GapFillBuilder
          key={exerciseId}
          exerciseId={exerciseId}
          containerId={container.id}
          initialExercise={gapFillDocumentFrom(exercise, container.id)}
          initialInstructions={firstInstruction(exercise)?.instructionText ?? ''}
          initialHint={firstInstruction(exercise)?.hintText ?? ''}
          onDocumentChange={(document, instructions) =>
            setGapFill({ exercise: document, instructions })
          }
          onSavedRemote={(updatedAt, saved) =>
            // The cached exercise is what the builder mounts from next time. Left as it
            // was fetched, that mount opens on a superseded version, and its first save
            // is refused as somebody else's edit — with no one else in the building.
            queryClient.setQueryData<ExerciseWithAnswers | null>(
              authoringKeys.exercise(exerciseId),
              (cached) => (cached ? applySavedGapFill(cached, updatedAt, saved) : cached),
            )
          }
        />
      ) : isErrorCorrection ? (
        // Error correction owns a document too, and for a sharper reason than gap-fill:
        // the mistakes are never written down, they are the difference between the two
        // sentences the author types. There is no set of form fields that could hold that.
        <ErrorCorrectionBuilder
          key={exerciseId}
          exerciseId={exerciseId}
          containerId={container.id}
          initialExercise={errorCorrectionDocumentFrom(exercise, container.id)}
          onDocumentChange={setErrorCorrection}
          onSavedRemote={(updatedAt, saved) =>
            queryClient.setQueryData<ExerciseWithAnswers | null>(
              authoringKeys.exercise(exerciseId),
              (cached) => (cached ? applySavedErrorCorrection(cached, updatedAt, saved) : cached),
            )
          }
        />
      ) : (
        <ExerciseForm
          // Remounts with fresh `defaultValues` when the loaded exercise changes.
          key={exerciseId}
          exerciseId={exerciseId}
          initialValues={initialValues}
          container={container}
          onValuesChange={setPreviewValues}
        />
      )}
    </LessonEditorShell>
  );
}

/** The instruction row the builder edits — one language, as everywhere else in authoring. */
function firstInstruction(exercise: ExerciseWithAnswers): ExerciseInstruction | undefined {
  return exercise.instructions?.[0];
}

/**
 * The stored columns as the kernel's document. `updatedAt` doubles as the autosave
 * concurrency token, and an exercise served without one would make every save
 * unconditional — so its absence is an empty token, which the server refuses.
 */
function gapFillDocumentFrom(exercise: ExerciseWithAnswers, containerId: string) {
  return fromPersisted(
    {
      id: exercise.id,
      moduleId: containerId,
      // The platform has no title on an exercise; instructions carry that job.
      title: '',
      instructions: firstInstruction(exercise)?.instructionText ?? '',
      updatedAt: exercise.updatedAt ?? '',
    },
    exercise.content,
    exercise.expectedAnswers,
  );
}

/**
 * The cached exercise as the save just left it on the server: both columns and the token,
 * so a later mount reads its own work rather than the version it started from.
 */
function applySavedGapFill(
  cached: ExerciseWithAnswers,
  updatedAt: string,
  saved: SavedDocument,
): ExerciseWithAnswers {
  const [instruction, ...rest] = cached.instructions ?? [];
  return {
    ...cached,
    updatedAt,
    content: { ...toContent(saved.exercise) },
    expectedAnswers: { ...toExpectedAnswers(saved.exercise) },
    ...(instruction && {
      instructions: [
        {
          ...instruction,
          instructionText: saved.instructions.trim(),
          hintText: saved.hint.trim() || instruction.hintText,
        },
        ...rest,
      ],
    }),
  };
}

/** The stored columns as the kernel's error-correction document. See above for the token. */
function errorCorrectionDocumentFrom(
  exercise: ExerciseWithAnswers,
  containerId: string,
): ErrorCorrection {
  return errorCorrectionFromPersisted(
    {
      id: exercise.id,
      moduleId: containerId,
      title: '',
      instructions: firstInstruction(exercise)?.instructionText ?? '',
      updatedAt: exercise.updatedAt ?? '',
    },
    exercise.content,
    exercise.expectedAnswers,
  );
}

/**
 * The cached exercise as the save just left it on the server: both columns and the token,
 * so a later mount reads its own work rather than the version it started from.
 */
function applySavedErrorCorrection(
  cached: ExerciseWithAnswers,
  updatedAt: string,
  saved: ErrorCorrection,
): ExerciseWithAnswers {
  const [instruction, ...rest] = cached.instructions ?? [];
  return {
    ...cached,
    updatedAt,
    content: { ...errorCorrectionToContent(saved) },
    expectedAnswers: { ...errorCorrectionToExpectedAnswers(saved) },
    ...(instruction && {
      instructions: [{ ...instruction, instructionText: saved.instructions.trim() }, ...rest],
    }),
  };
}

interface ExerciseFormProps {
  exerciseId: string;
  initialValues: ExerciseFormValues;
  container: Container;
  onValuesChange: (values: ExerciseFormValues) => void;
}

function ExerciseForm({ exerciseId, initialValues, container, onValuesChange }: ExerciseFormProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  // Not `useSaveScopeDescription`: that answers the placement question, and an
  // exercise document is held for publish either way.
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ExerciseFormValues>({
    resolver: zodResolver(exerciseFormSchema),
    defaultValues: initialValues,
  });

  const watched = useWatch({ control });
  useEffect(() => {
    onValuesChange({ ...DEFAULT_EXERCISE_VALUES, ...watched } as ExerciseFormValues);
  }, [watched, onValuesChange]);

  function onSubmit(data: ExerciseFormValues) {
    startTransition(async () => {
      const result = await updateExerciseAction(exerciseId, container.id, data);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.exercise(exerciseId) });
      await queryClient.invalidateQueries({ queryKey: authoringKeys.exercises(container.id) });
      toast.success(t('exercises.saveSuccess'), {
        description: t('saveScope.exerciseDraftToast'),
      });
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <ExerciseFields control={control} register={register} errors={errors} isPending={isPending} />
      <Button type="submit" loading={isPending}>
        {t('form.save')}
      </Button>
    </form>
  );
}
