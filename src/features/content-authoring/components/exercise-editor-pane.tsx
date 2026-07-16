'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useForm, useFieldArray, useController, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { Container, ExerciseDisplay } from '@/features/content/types';
import type { MaterialKind } from '@/lib/content/lesson-types';

import {
  exerciseFormSchema,
  EXERCISE_TYPES,
  DIFFICULTY_LEVELS,
  type ExerciseFormValues,
  type ExerciseType,
} from '../schemas/exercise';
import { updateExerciseAction } from '../actions/exercise';
import { useAuthoringExercise } from '../api/use-authoring-exercises';
import { authoringKeys } from '../api/keys';
import { LessonEditorShell } from './lesson-editor-shell';
import { EditorCard } from './editor-card';
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

const NO_DIFFICULTY_LEVEL = '__none__';

const DEFAULT_VALUES: ExerciseFormValues = {
  templateCode: 'cloze',
  instructions: '',
  difficultyLevel: undefined,
  clozeTemplate: '',
  clozeAnswers: [],
  mcQuestion: '',
  mcOptions: [{ text: '' }, { text: '' }],
  mcCorrectIndex: 0,
  ftPrompt: '',
  ftSampleAnswer: '',
  pronText: '',
  pronIpa: '',
};

function parseExerciseContent(exercise: ExerciseDisplay): ExerciseFormValues {
  const { templateCode, content, instructions, difficultyLevel } = exercise;
  const base: ExerciseFormValues = {
    ...DEFAULT_VALUES,
    templateCode: (EXERCISE_TYPES as readonly string[]).includes(templateCode)
      ? (templateCode as ExerciseType)
      : 'cloze',
    instructions: instructions ?? '',
    difficultyLevel,
  };

  switch (templateCode) {
    case 'cloze': {
      const c = content as { template?: string; blanks?: Array<{ answer: string }> };
      return {
        ...base,
        clozeTemplate: c.template ?? '',
        clozeAnswers: (c.blanks ?? []).map((b) => ({ text: b.answer })),
      };
    }
    case 'multiple_choice': {
      const c = content as { question?: string; options?: string[]; correctIndex?: number };
      return {
        ...base,
        mcQuestion: c.question ?? '',
        mcOptions:
          c.options && c.options.length >= 2
            ? c.options.map((text) => ({ text }))
            : [{ text: '' }, { text: '' }],
        mcCorrectIndex: c.correctIndex ?? 0,
      };
    }
    case 'free_text': {
      const c = content as { prompt?: string; sampleAnswer?: string };
      return { ...base, ftPrompt: c.prompt ?? '', ftSampleAnswer: c.sampleAnswer ?? '' };
    }
    case 'pronunciation': {
      const c = content as { text?: string; ipa?: string };
      return { ...base, pronText: c.text ?? '', pronIpa: c.ipa ?? '' };
    }
    default:
      return base;
  }
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
  const initialValues = exercise ? parseExerciseContent(exercise) : DEFAULT_VALUES;
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
          // Remounts (with fresh `defaultValues`) if the loaded exercise changes,
          // rather than reconciling via RHF's `reset` — keeps a single Controller
          // field (`templateCode`) from transiently desyncing mid-render.
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
    onValuesChange({ ...DEFAULT_VALUES, ...watched } as ExerciseFormValues);
  }, [watched, onValuesChange]);

  const { fields: clozeAnswerFields, append: appendAnswer, remove: removeAnswer } = useFieldArray({
    control,
    name: 'clozeAnswers',
  });
  const { fields: mcOptionFields, append: appendOption, remove: removeOption } = useFieldArray({
    control,
    name: 'mcOptions',
  });

  const typeCtrl = useController({ control, name: 'templateCode' });
  const levelCtrl = useController({ control, name: 'difficultyLevel' });
  const correctIndexCtrl = useController({ control, name: 'mcCorrectIndex' });

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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('exercises.type')} htmlFor="ex-type" error={errors.templateCode?.message} required>
          <Select
            value={typeCtrl.field.value}
            onValueChange={(v) => typeCtrl.field.onChange(v as ExerciseType)}
            disabled={isPending}
          >
            <SelectTrigger id="ex-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXERCISE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`exercises.types.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t('exercises.difficultyLevel')} htmlFor="ex-difficulty" error={errors.difficultyLevel?.message}>
          <Select
            value={levelCtrl.field.value ?? NO_DIFFICULTY_LEVEL}
            onValueChange={(v) =>
              levelCtrl.field.onChange(v === NO_DIFFICULTY_LEVEL ? undefined : (v as (typeof DIFFICULTY_LEVELS)[number]))
            }
            disabled={isPending}
          >
            <SelectTrigger id="ex-difficulty" className="w-full">
              <SelectValue placeholder={t('exercises.difficultyLevelNone')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_DIFFICULTY_LEVEL}>{t('exercises.difficultyLevelNone')}</SelectItem>
              {DIFFICULTY_LEVELS.map((lvl) => (
                <SelectItem key={lvl} value={lvl}>
                  {lvl}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label={t('exercises.instructions')} htmlFor="ex-instructions">
        <Textarea
          id="ex-instructions"
          rows={2}
          placeholder={t('exercises.instructionsPlaceholder')}
          disabled={isPending}
          {...register('instructions')}
        />
      </Field>

      {typeCtrl.field.value === 'cloze' && (
        <EditorCard title={t('exercises.types.cloze')}>
          <div className="space-y-4">
            <Field
              label={t('exercises.clozeTemplate')}
              htmlFor="ex-cloze-tmpl"
              error={errors.clozeTemplate?.message}
              required
            >
              <Textarea
                id="ex-cloze-tmpl"
                rows={4}
                placeholder={t('exercises.clozeTemplatePlaceholder')}
                className="font-mono text-sm"
                disabled={isPending}
                {...register('clozeTemplate')}
              />
            </Field>

            <div className="space-y-2">
              <p className="text-sm font-medium text-(--ssz-text-primary)">{t('exercises.clozeAnswers')}</p>
              {clozeAnswerFields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder={t('exercises.clozeAnswerPlaceholder')}
                      hasError={!!errors.clozeAnswers?.[index]?.text}
                      disabled={isPending}
                      {...register(`clozeAnswers.${index}.text`)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAnswer(index)}
                    aria-label={t('exercises.removeAnswer')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => appendAnswer({ text: '' })}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t('exercises.addAnswer')}
              </Button>
            </div>
          </div>
        </EditorCard>
      )}

      {typeCtrl.field.value === 'multiple_choice' && (
        <EditorCard title={t('exercises.types.multiple_choice')}>
          <div className="space-y-4">
            <Field
              label={t('exercises.mcQuestion')}
              htmlFor="ex-mc-q"
              error={errors.mcQuestion?.message}
              required
            >
              <Textarea
                id="ex-mc-q"
                rows={2}
                placeholder={t('exercises.mcQuestionPlaceholder')}
                disabled={isPending}
                {...register('mcQuestion')}
              />
            </Field>

            <div className="space-y-2">
              <p className="text-sm font-medium text-(--ssz-text-primary)">{t('exercises.mcOptions')}</p>
              {typeof errors.mcOptions?.message === 'string' && (
                <p className="text-xs text-destructive">{errors.mcOptions.message}</p>
              )}
              {mcOptionFields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    className="h-4 w-4 shrink-0 accent-primary"
                    checked={correctIndexCtrl.field.value === index}
                    onChange={() => correctIndexCtrl.field.onChange(index)}
                    aria-label={t('exercises.mcCorrect')}
                  />
                  <div className="flex-1">
                    <Input
                      placeholder={t('exercises.mcOptionPlaceholder')}
                      hasError={!!errors.mcOptions?.[index]?.text}
                      disabled={isPending}
                      {...register(`mcOptions.${index}.text`)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      removeOption(index);
                      if (correctIndexCtrl.field.value === index) {
                        correctIndexCtrl.field.onChange(0);
                      } else if (
                        correctIndexCtrl.field.value !== undefined &&
                        correctIndexCtrl.field.value > index
                      ) {
                        correctIndexCtrl.field.onChange(correctIndexCtrl.field.value - 1);
                      }
                    }}
                    disabled={mcOptionFields.length <= 2}
                    aria-label={t('exercises.removeOption')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => appendOption({ text: '' })}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t('exercises.addOption')}
              </Button>
            </div>
          </div>
        </EditorCard>
      )}

      {typeCtrl.field.value === 'free_text' && (
        <EditorCard title={t('exercises.types.free_text')}>
          <div className="space-y-4">
            <Field label={t('exercises.ftPrompt')} htmlFor="ex-ft-prompt" error={errors.ftPrompt?.message} required>
              <Textarea
                id="ex-ft-prompt"
                rows={3}
                placeholder={t('exercises.ftPromptPlaceholder')}
                disabled={isPending}
                {...register('ftPrompt')}
              />
            </Field>
            <Field label={t('exercises.ftSampleAnswer')} htmlFor="ex-ft-sample">
              <Textarea
                id="ex-ft-sample"
                rows={3}
                placeholder={t('exercises.ftSampleAnswerPlaceholder')}
                disabled={isPending}
                {...register('ftSampleAnswer')}
              />
            </Field>
          </div>
        </EditorCard>
      )}

      {typeCtrl.field.value === 'pronunciation' && (
        <EditorCard title={t('exercises.types.pronunciation')}>
          <div className="space-y-4">
            <Field label={t('exercises.pronText')} htmlFor="ex-pron-text" error={errors.pronText?.message} required>
              <Input
                id="ex-pron-text"
                placeholder={t('exercises.pronTextPlaceholder')}
                hasError={!!errors.pronText}
                disabled={isPending}
                {...register('pronText')}
              />
            </Field>
            <Field label={t('exercises.pronIpa')} htmlFor="ex-pron-ipa">
              <Input
                id="ex-pron-ipa"
                placeholder={t('exercises.pronIpaPlaceholder')}
                className="font-mono"
                disabled={isPending}
                {...register('pronIpa')}
              />
            </Field>
          </div>
        </EditorCard>
      )}

      <Button type="submit" loading={isPending}>
        {t('form.save')}
      </Button>
    </form>
  );
}
