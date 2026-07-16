'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Container } from '@/features/content/types';
import type { MaterialKind } from '@/lib/content/lesson-types';

import { exerciseFormSchema, type ExerciseFormValues } from '../schemas/exercise';
import { DEFAULT_EXERCISE_VALUES, parseExerciseToForm } from '../lib/exercise-content';
import { updateExerciseAction } from '../actions/exercise';
import { useAuthoringExercise } from '../api/use-authoring-exercises';
import { authoringKeys } from '../api/keys';
import { LessonEditorShell } from './lesson-editor-shell';
import { ExerciseFields } from './exercise-fields';
import { ExerciseLessonPreview } from './exercise-lesson-preview';

interface ExerciseEditorPaneProps {
  kind: MaterialKind;
  exerciseId: string;
  lessonTitle: string | null;
  state: 'draft' | 'published' | null;
  container: Container;
  backHref: string;
  publishSlot: ReactNode;
}

export function ExerciseEditorPane({
  kind,
  exerciseId,
  lessonTitle,
  state,
  container,
  backHref,
  publishSlot,
}: ExerciseEditorPaneProps) {
  const t = useTranslations('Authoring');
  const { data: exercise, isLoading } = useAuthoringExercise(exerciseId);
  const initialValues = exercise ? parseExerciseToForm(exercise) : DEFAULT_EXERCISE_VALUES;
  const [previewValues, setPreviewValues] = useState<ExerciseFormValues>(initialValues);

  return (
    <LessonEditorShell
      kind={kind}
      title={lessonTitle || t('lessons.untitled')}
      state={state}
      backHref={backHref}
      autosaveStatus="idle"
      autosaveSavedAt={null}
      publishSlot={publishSlot}
      preview={<ExerciseLessonPreview title={lessonTitle ?? ''} values={previewValues} />}
    >
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
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

interface ExerciseFormProps {
  exerciseId: string;
  initialValues: ExerciseFormValues;
  container: Container;
  onValuesChange: (values: ExerciseFormValues) => void;
}

function ExerciseForm({ exerciseId, initialValues, container, onValuesChange }: ExerciseFormProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
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
      toast.success(t('exercises.saveSuccess'));
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
