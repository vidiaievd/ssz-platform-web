'use client';

import { useMemo, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { buildGlossaryIndex } from '@/features/learning';
import { useLesson, useUnitVocabularyItems } from '@/features/content';
import type { Container } from '@/features/content/types';
import type { MaterialKind } from '@/lib/content/lesson-types';

import { lessonFormSchema, type LessonFormValues } from '../schemas/lesson';
import { updateLessonAction } from '../actions/lesson';
import { useLessonVariants, useLessonCues, useLessonGlossaryMarks } from '../api/use-authoring-lessons';
import { useAuthoringVocabularyLists } from '../api/use-authoring-vocabulary';
import { authoringKeys } from '../api/keys';
import { useAutosave } from '../hooks/use-autosave';
import { LessonEditorShell } from './lesson-editor-shell';
import { VideoLessonPreview } from './video-lesson-preview';
import { VideoSourceSlot } from './video-source-slot';
import { CueListEditor } from './cue-list-editor';
import { ComprehensionQuestionRow } from './comprehension-question-row';

interface VideoEditorPaneProps {
  kind: MaterialKind;
  lessonId: string;
  lessonTitle: string | null;
  state: 'draft' | 'published' | null;
  container: Container;
  backHref: string;
  publishSlot: ReactNode;
}

export function VideoEditorPane({
  kind,
  lessonId,
  lessonTitle,
  state,
  container,
  backHref,
  publishSlot,
}: VideoEditorPaneProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();

  const { data: variants, isLoading: variantsLoading } = useLessonVariants(lessonId);
  const defaultVariant = variants?.[0];
  const { data: cues } = useLessonCues(lessonId, defaultVariant?.id);

  const lesson = useLesson(lessonId);
  const { data: vocabLists } = useAuthoringVocabularyLists(container.id);
  const vocabList = vocabLists?.[0];
  const vocabItems = useUnitVocabularyItems(vocabList?.id ?? '', !!vocabList);
  const { data: marks } = useLessonGlossaryMarks(lessonId, defaultVariant?.id);
  const glossary = useMemo(() => {
    const markedIds = new Set((marks ?? []).map((m) => m.vocabularyItemId));
    return buildGlossaryIndex((vocabItems.data ?? []).filter((item) => markedIds.has(item.id)));
  }, [marks, vocabItems.data]);

  const {
    register,
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<LessonFormValues>({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: { title: lessonTitle ?? '', body: '' },
    values: defaultVariant
      ? { title: defaultVariant.displayTitle, body: defaultVariant.bodyMarkdown }
      : lessonTitle
        ? { title: lessonTitle, body: '' }
        : undefined,
  });

  const titleValue = useWatch({ control, name: 'title' });
  const bodyValue = useWatch({ control, name: 'body' });

  async function saveLesson(data: LessonFormValues) {
    const result = await updateLessonAction(
      lessonId,
      container.id,
      defaultVariant?.id ?? null,
      container.difficultyLevel,
      data,
    );
    if (!result.ok) return result;
    await queryClient.invalidateQueries({ queryKey: authoringKeys.lessonVariants(lessonId) });
    return result;
  }

  const autosave = useAutosave({
    onSave: async () => {
      const result = await saveLesson(getValues());
      if (!result.ok) throw new Error(result.error.code);
    },
    debounceMs: 800,
  });

  function handleBodyTokenChange(newBody: string) {
    setValue('body', newBody);
    autosave.schedule();
  }

  return (
    <LessonEditorShell
      kind={kind}
      title={titleValue || lessonTitle || t('lessons.untitled')}
      state={state}
      backHref={backHref}
      autosaveStatus={autosave.status}
      autosaveSavedAt={autosave.savedAt}
      publishSlot={publishSlot}
      preview={
        <VideoLessonPreview
          title={titleValue ?? ''}
          body={bodyValue ?? ''}
          cues={cues ?? []}
          glossary={glossary}
          targetLang={lesson.data?.targetLanguage}
        />
      }
    >
      {variantsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label={t('fields.title')} htmlFor="lesson-title" error={errors.title?.message} required>
            <Input
              id="lesson-title"
              placeholder={t('lessons.titlePlaceholder')}
              hasError={!!errors.title}
              {...register('title', { onChange: () => autosave.schedule() })}
            />
          </Field>

          <VideoSourceSlot body={bodyValue ?? ''} onChange={handleBodyTokenChange} />

          <Button
            type="button"
            onClick={() => {
              autosave.cancel();
              void (async () => {
                const result = await saveLesson(getValues());
                if (!result.ok) {
                  toast.error(tErrors(result.error.code));
                  return;
                }
                autosave.markSaved();
                toast.success(t('lessons.saveSuccess'));
              })();
            }}
          >
            {t('form.save')}
          </Button>

          <CueListEditor lessonId={lessonId} variantId={defaultVariant?.id} />

          <ComprehensionQuestionRow
            lessonId={lessonId}
            variantId={defaultVariant?.id}
            container={container}
          />
        </div>
      )}
    </LessonEditorShell>
  );
}
