'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
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
import {
  fromPersisted as translateFromPersisted,
  isTranslateCode,
  toContent as translateToContent,
  toExpectedAnswers as translateToExpectedAnswers,
  type Translate,
  type TranslateType,
} from '@/lib/shared-kernel/translate';
import {
  fromPersisted as matchPairsFromPersisted,
  TEMPLATE_CODE as MATCH_PAIRS_TEMPLATE_CODE,
  toContent as matchPairsToContent,
  toExpectedAnswers as matchPairsToExpectedAnswers,
  type MatchPairs,
} from '@/lib/shared-kernel/match-pairs';
import {
  fromPersisted as writingTaskFromPersisted,
  TEMPLATE_CODE as WRITING_TASK_TEMPLATE_CODE,
  toContent as writingTaskToContent,
  toExpectedAnswers as writingTaskToExpectedAnswers,
  type WritingTask,
} from '@/lib/shared-kernel/writing-task';
import {
  fromPersisted as shortAnswerFromPersisted,
  isShortAnswerDocument,
  toContent as shortAnswerToContent,
  toExpectedAnswers as shortAnswerToExpectedAnswers,
} from '@/lib/shared-kernel/short-answer';
import {
  fromPersisted as sentenceSchemaFromPersisted,
  TEMPLATE_CODE as SENTENCE_SCHEMA_TEMPLATE_CODE,
  toContent as sentenceSchemaToContent,
  toExpectedAnswers as sentenceSchemaToExpectedAnswers,
} from '@/lib/shared-kernel/sentence-schema';
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
import { TranslateBuilder } from './translate/builder';
import { TranslatePreview } from './translate/translate-preview';
import { MatchPairsBuilder } from './match-pairs/builder';
import { MatchPairsPreview } from './match-pairs/match-pairs-preview';
import { hasExplicitVariant } from './match-pairs/edits';
import { ShortAnswerBuilder } from './short-answer/builder';
import { ShortAnswerPreview } from './short-answer/short-answer-preview';
import type { ShortAnswerDocument } from './short-answer/edits';
import type { SavedDocument as SavedShortAnswer } from './short-answer/use-short-answer-autosave';
import { SentenceSchemaBuilder } from './sentence-schema/builder';
import { SentenceSchemaPreview } from './sentence-schema/sentence-schema-preview';
import type { SentenceSchemaDocument } from './sentence-schema/edits';
import type { SavedDocument as SavedSentenceSchema } from './sentence-schema/use-sentence-schema-autosave';
import { WritingTaskBuilder } from './writing-task/builder';
import { WritingTaskPreview } from './writing-task/writing-task-preview';
import type { SavedDocument as SavedWritingTask } from './writing-task/use-writing-task-autosave';
import type { SavedDocument as SavedMatchPairs } from './match-pairs/use-match-pairs-autosave';
import { ExerciseLessonPreview } from './exercise-lesson-preview';
import type { LevelGrammarRule } from '../lib/level-grammar-rules';

interface ExerciseEditorPaneProps {
  kind: MaterialKind;
  exerciseId: string;
  lessonTitle: string | null;
  state: 'draft' | 'published' | null;
  /** Whether students can open this material right now — see `SaveScopeContext`. */
  isLive: boolean | null;
  container: Container;
  /** The grammar rules of this Leksjon; only the translate builder uses them so far. */
  grammarRules?: LevelGrammarRule[];
  /** Where this exercise's marking queue lives. Offered only where one can fill up. */
  reviewHref?: string;
  publishSlot: ReactNode;
}

export function ExerciseEditorPane({
  kind,
  exerciseId,
  lessonTitle,
  state,
  isLive,
  grammarRules,
  container,
  reviewHref,
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
  /** The translate document as its builder currently has it, for the preview column. */
  const [translate, setTranslate] = useState<Translate | null>(null);
  /** The match-pairs document as its builder currently has it, for the preview column. */
  const [matchPairs, setMatchPairs] = useState<{
    exercise: MatchPairs;
    instructions: string;
  } | null>(null);

  /** The writing-task document as its builder currently has it, for the preview column. */
  const [writingTask, setWritingTask] = useState<WritingTask | null>(null);

  /** The short-answer document as its builder currently has it, for the preview column. */
  const [shortAnswer, setShortAnswer] = useState<ShortAnswerDocument | null>(null);

  /** The sentence-schema document as its builder currently has it, for the preview column. */
  const [sentenceSchema, setSentenceSchema] = useState<SentenceSchemaDocument | null>(null);

  const isGapFill = exercise?.templateCode === TEMPLATE_CODE;
  const isErrorCorrection = exercise?.templateCode === ERROR_CORRECTION_TEMPLATE_CODE;
  const isTranslate = isTranslateCode(exercise?.templateCode);
  const isMatchPairs = exercise?.templateCode === MATCH_PAIRS_TEMPLATE_CODE;
  const isWritingTask = exercise?.templateCode === WRITING_TASK_TEMPLATE_CODE;
  /*
    By the shape of the document, not by the template code — plan 51 §8 Q1. The 144
    exercises written in the old single-question form keep opening in the generic form,
    which is still the only thing that can edit them; everything created since phase 2 is
    of the new form and belongs to the builder. A dispatch on `templateCode` would send
    both to the same place and one of them would be wrong.
  */
  const isShortAnswer = exercise != null && isShortAnswerDocument(exercise.content);
  /*
    By the template code, unlike `short_answer` — plan 52 §8 Q7. The old form of this type
    was removed from the catalogue rather than kept alive beside the new one, so there is
    no second shape to dispatch on: every `sentence_schema` exercise belongs to the
    builder, and a document that is not of the new form is refused by the runner and the
    server alike rather than opened in a form that could not edit it anyway.
  */
  const isSentenceSchema = exercise?.templateCode === SENTENCE_SCHEMA_TEMPLATE_CODE;

  return (
    <LessonEditorShell
      kind={kind}
      title={lessonTitle || t('lessons.untitled')}
      state={state}
      isLive={isLive}
      // An exercise document waits in its draft whatever its placement says.
      savesHeldForPublish
      saveStatus="idle"
      savedAt={null}
      publishSlot={
        <>
          {/*
            Only for the templates whose attempts can reach a queue. Closed-form exercises
            are scored the moment they are handed in, so a link to their marking queue
            would lead to a page that is empty by construction.
          */}
          {reviewHref !== undefined &&
            (isTranslate || isErrorCorrection || isWritingTask || isShortAnswer) && (
              <Button asChild variant="outline" size="sm">
                <Link href={reviewHref}>{t('review.openQueue')}</Link>
              </Button>
            )}
          {publishSlot}
        </>
      }
      preview={
        isGapFill && gapFill !== null ? (
          <GapFillPreview exercise={gapFill.exercise} instructions={gapFill.instructions} />
        ) : isErrorCorrection && errorCorrection !== null ? (
          <ErrorCorrectionPreview exercise={errorCorrection} />
        ) : isTranslate && translate !== null ? (
          <TranslatePreview exercise={translate} />
        ) : isMatchPairs && matchPairs !== null ? (
          <MatchPairsPreview
            exercise={matchPairs.exercise}
            instructions={matchPairs.instructions}
          />
        ) : isWritingTask && writingTask !== null ? (
          <WritingTaskPreview exercise={writingTask} />
        ) : isShortAnswer && shortAnswer !== null ? (
          <ShortAnswerPreview exercise={shortAnswer} />
        ) : isSentenceSchema && sentenceSchema !== null ? (
          <SentenceSchemaPreview exercise={sentenceSchema} />
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
      ) : isTranslate && exercise !== undefined ? (
        // Translate owns a document for the plainest reason of the three: the accepted
        // translations *are* the answer, and authoring them is writing a set of sentences
        // with a key each, not filling in a form field.
        <TranslateBuilder
          key={exerciseId}
          exerciseId={exerciseId}
          containerId={container.id}
          initialExercise={translateDocumentFrom(exercise, container.id)}
          grammarRules={grammarRules}
          onDocumentChange={setTranslate}
          onSavedRemote={(updatedAt, saved) =>
            queryClient.setQueryData<ExerciseWithAnswers | null>(
              authoringKeys.exercise(exerciseId),
              (cached) => (cached ? applySavedTranslate(cached, updatedAt, saved) : cached),
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
      ) : isMatchPairs && exercise !== undefined ? (
        // Match pairs owns a document for the sharpest reason of the four: the pairing
        // *is* the content — a pair's right half is the answer to its left — so there is
        // no set of form fields that could hold it without writing the answer twice.
        <MatchPairsBuilder
          key={exerciseId}
          exerciseId={exerciseId}
          containerId={container.id}
          initialExercise={matchPairsDocumentFrom(exercise, container.id)}
          initialInstructions={firstInstruction(exercise)?.instructionText ?? ''}
          // An absent `variant` parses as `pairs`, which carries the weaker publication
          // rule. Only the raw column can still say whether anyone chose it.
          initialVariantChosen={hasExplicitVariant(exercise.content)}
          onDocumentChange={(document, instructions) =>
            setMatchPairs({ exercise: document, instructions })
          }
          onSavedRemote={(updatedAt, saved) =>
            queryClient.setQueryData<ExerciseWithAnswers | null>(
              authoringKeys.exercise(exerciseId),
              (cached) => (cached ? applySavedMatchPairs(cached, updatedAt, saved) : cached),
            )
          }
        />
      ) : isWritingTask && exercise !== undefined ? (
        // A writing task owns a document because there is no answer to hold: the exercise
        // *is* the task, the rubric a person marks against, and the settings that decide
        // what the student may see while writing. The generic form has a prompt field and
        // a word count, which is the shape this template left behind in plan 50.
        <WritingTaskBuilder
          key={exerciseId}
          exerciseId={exerciseId}
          containerId={container.id}
          initialExercise={writingTaskDocumentFrom(exercise, container.id)}
          onDocumentChange={setWritingTask}
          onSavedRemote={(updatedAt, saved) =>
            queryClient.setQueryData<ExerciseWithAnswers | null>(
              authoringKeys.exercise(exerciseId),
              (cached) => (cached ? applySavedWritingTask(cached, updatedAt, saved) : cached),
            )
          }
        />
      ) : isShortAnswer && exercise != null ? (
        // Short answer owns a document because its key is not a list of accepted strings
        // but a set of semantic elements, each carrying the phrasings a student might use
        // — and those phrasings are the answer, written in the words the student is being
        // asked to find. The generic form has one question field and a comma-separated
        // list of accepted answers, which is the shape this template left behind in the
        // plan; documents still in that shape never reach here.
        <ShortAnswerBuilder
          key={exerciseId}
          exerciseId={exerciseId}
          containerId={container.id}
          initialExercise={shortAnswerDocumentFrom(exercise)}
          onDocumentChange={setShortAnswer}
          onSavedRemote={(updatedAt, saved) =>
            queryClient.setQueryData<ExerciseWithAnswers | null>(
              authoringKeys.exercise(exerciseId),
              (cached) => (cached ? applySavedShortAnswer(cached, updatedAt, saved) : cached),
            )
          }
        />
      ) : isSentenceSchema && exercise != null ? (
        // Sentence schema owns a document because the answer is not written anywhere: it
        // *is* where each chunk sits on the board, and that same placement is the word
        // bank the student is handed. The generic form had a list of fields and a list of
        // tokens, which is the shape this template left behind in plan 52.
        <SentenceSchemaBuilder
          key={exerciseId}
          exerciseId={exerciseId}
          containerId={container.id}
          targetLanguage={container.targetLanguage}
          initialExercise={sentenceSchemaDocumentFrom(exercise)}
          onDocumentChange={setSentenceSchema}
          onSavedRemote={(updatedAt, saved) =>
            queryClient.setQueryData<ExerciseWithAnswers | null>(
              authoringKeys.exercise(exerciseId),
              (cached) => (cached ? applySavedSentenceSchema(cached, updatedAt, saved) : cached),
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

/** The stored columns as the kernel's match-pairs document. See above for the token. */
function matchPairsDocumentFrom(exercise: ExerciseWithAnswers, containerId: string): MatchPairs {
  return matchPairsFromPersisted(
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
function applySavedMatchPairs(
  cached: ExerciseWithAnswers,
  updatedAt: string,
  saved: SavedMatchPairs,
): ExerciseWithAnswers {
  const [instruction, ...rest] = cached.instructions ?? [];
  return {
    ...cached,
    updatedAt,
    content: { ...matchPairsToContent(saved.exercise) },
    expectedAnswers: { ...matchPairsToExpectedAnswers(saved.exercise) },
    ...(instruction && {
      instructions: [{ ...instruction, instructionText: saved.instructions.trim() }, ...rest],
    }),
  };
}

/** The stored columns as the kernel's writing-task document. See above for the token. */
function writingTaskDocumentFrom(exercise: ExerciseWithAnswers, containerId: string): WritingTask {
  return writingTaskFromPersisted(
    {
      id: exercise.id,
      moduleId: containerId,
      title: '',
      updatedAt: exercise.updatedAt ?? '',
    },
    exercise.content,
    exercise.expectedAnswers,
  );
}

/**
 * The cached exercise as the save just left it on the server: both columns and the token,
 * so a later mount reads its own work rather than the version it started from.
 *
 * The instruction row follows the document's own `instruction` rather than a field of its
 * own — one line, written to both places (see `use-writing-task-autosave.ts`).
 */
function applySavedWritingTask(
  cached: ExerciseWithAnswers,
  updatedAt: string,
  saved: SavedWritingTask,
): ExerciseWithAnswers {
  const [instruction, ...rest] = cached.instructions ?? [];
  return {
    ...cached,
    updatedAt,
    content: { ...writingTaskToContent(saved.exercise) },
    expectedAnswers: { ...writingTaskToExpectedAnswers(saved.exercise) },
    ...(instruction && {
      instructions: [
        { ...instruction, instructionText: saved.exercise.instruction.trim() },
        ...rest,
      ],
    }),
  };
}

/**
 * The stored columns as the kernel's short-answer document, plus the row's token.
 *
 * No `id`/`moduleId`/`title` envelope here, unlike the five before it: this kernel's
 * document is the content and nothing else (plan 51 §4), and the builder's envelope adds
 * only what it actually uses — `updatedAt`, which is the autosave concurrency token. An
 * exercise served without one would make every save unconditional, so its absence is an
 * empty token, which the server refuses.
 */
function shortAnswerDocumentFrom(exercise: ExerciseWithAnswers): ShortAnswerDocument {
  return {
    ...shortAnswerFromPersisted(exercise.content, exercise.expectedAnswers),
    updatedAt: exercise.updatedAt ?? '',
  };
}

/**
 * The cached exercise as the save just left it on the server: both columns and the token,
 * so a later mount reads its own work rather than the version it started from.
 *
 * The instruction row follows the document's own `instruction` rather than a field of its
 * own — one line, written to both places (see `use-short-answer-autosave.ts`).
 */
function applySavedShortAnswer(
  cached: ExerciseWithAnswers,
  updatedAt: string,
  saved: SavedShortAnswer,
): ExerciseWithAnswers {
  const [instruction, ...rest] = cached.instructions ?? [];
  return {
    ...cached,
    updatedAt,
    content: { ...shortAnswerToContent(saved.exercise) },
    expectedAnswers: { ...shortAnswerToExpectedAnswers(saved.exercise) },
    ...(instruction && {
      instructions: [
        { ...instruction, instructionText: saved.exercise.instruction.trim() },
        ...rest,
      ],
    }),
  };
}

/**
 * The stored columns as the kernel's sentence-schema document, plus the row's token.
 *
 * No `id`/`moduleId`/`title` envelope, as with `short_answer`: this kernel's document is
 * the content and nothing else, and the builder's envelope adds only what it uses —
 * `updatedAt`, the autosave concurrency token. An exercise served without one would make
 * every save unconditional, so its absence is an empty token, which the server refuses.
 */
function sentenceSchemaDocumentFrom(exercise: ExerciseWithAnswers): SentenceSchemaDocument {
  return {
    ...sentenceSchemaFromPersisted(exercise.content, exercise.expectedAnswers),
    updatedAt: exercise.updatedAt ?? '',
  };
}

/**
 * The cached exercise as the save just left it on the server: both columns and the token,
 * so a later mount reads its own work rather than the version it started from.
 *
 * The instruction row follows the document's own `instruction` rather than a field of its
 * own — one line, written to both places (see `use-sentence-schema-autosave.ts`).
 */
function applySavedSentenceSchema(
  cached: ExerciseWithAnswers,
  updatedAt: string,
  saved: SavedSentenceSchema,
): ExerciseWithAnswers {
  const [instruction, ...rest] = cached.instructions ?? [];
  return {
    ...cached,
    updatedAt,
    content: { ...sentenceSchemaToContent(saved.exercise) },
    expectedAnswers: { ...sentenceSchemaToExpectedAnswers(saved.exercise) },
    ...(instruction && {
      instructions: [
        { ...instruction, instructionText: saved.exercise.instruction.trim() },
        ...rest,
      ],
    }),
  };
}

/** The stored columns as the kernel's translate document. See above for the token. */
function translateDocumentFrom(exercise: ExerciseWithAnswers, containerId: string): Translate {
  return translateFromPersisted(
    {
      id: exercise.id,
      moduleId: containerId,
      title: '',
      instructions: firstInstruction(exercise)?.instructionText ?? '',
      updatedAt: exercise.updatedAt ?? '',
    },
    exercise.templateCode as TranslateType,
    exercise.content,
    exercise.expectedAnswers,
  );
}

/**
 * The cached exercise as the save just left it on the server: both columns and the token,
 * so a later mount reads its own work rather than the version it started from.
 */
function applySavedTranslate(
  cached: ExerciseWithAnswers,
  updatedAt: string,
  saved: Translate,
): ExerciseWithAnswers {
  const [instruction, ...rest] = cached.instructions ?? [];
  return {
    ...cached,
    updatedAt,
    content: { ...translateToContent(saved) },
    expectedAnswers: { ...translateToExpectedAnswers(saved) },
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
