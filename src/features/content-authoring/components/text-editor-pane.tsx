'use client';

import { useMemo, useRef, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { buildGlossaryIndex } from '@/features/learning';
import { useLesson, useUnitVocabularyItems } from '@/features/content';
import type { Container } from '@/features/content/types';
import type { MaterialKind } from '@/lib/content/lesson-types';

import type { LevelGrammarRule } from '../lib/level-grammar-rules';
import { lessonFormSchema, type LessonFormValues } from '../schemas/lesson';
import { updateLessonAction } from '../actions/lesson';
import { useLessonVariants, useLessonGlossaryMarks } from '../api/use-authoring-lessons';
import { useAuthoringVocabularyLists } from '../api/use-authoring-vocabulary';
import { authoringKeys } from '../api/keys';
import { useAutosave } from '../hooks/use-autosave';
import { LessonEditorShell } from './lesson-editor-shell';
import { EditorCard } from './editor-card';
import { TextLessonPreview } from './text-lesson-preview';
import { ParagraphTranslationsPanel } from './paragraph-translations-panel';
import { GlossaryMarkButton, GlossaryMarkedWords } from './glossary-mark-panel';
import { TextSpanMenu } from './text-span-menu';
import { TextSpanList } from './text-span-list';
import {
  MarkdownFormatMenu,
  applyMarkdownFormat,
  type MarkdownFormat,
} from './markdown-format-menu';
import { HeroImageSlot } from './hero-image-slot';
import { AudioNarrationRow } from './audio-narration-row';
import { ListeningStageListEditor } from './listening-stage-list-editor';

interface TextEditorPaneProps {
  kind: MaterialKind;
  lessonId: string;
  lessonTitle: string | null;
  state: 'draft' | 'published' | null;
  container: Container;
  /** Grammar rules of this module's Leksjon — the pool a grammar annotation may point at. */
  grammarRules?: LevelGrammarRule[];
  backHref: string;
  publishSlot: ReactNode;
}

export function TextEditorPane({
  kind,
  lessonId,
  lessonTitle,
  state,
  container,
  grammarRules = [],
  backHref,
  publishSlot,
}: TextEditorPaneProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();

  const { data: variants, isLoading: variantsLoading } = useLessonVariants(lessonId);
  const defaultVariant = variants?.[0];

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
    if (defaultVariant) {
      // Body edits re-split the anchor text into paragraphs — refresh the
      // translation panel's "target" column against the newly saved split.
      await queryClient.invalidateQueries({
        queryKey: authoringKeys.lessonParagraphs(lessonId, defaultVariant.id),
      });
      // A span's brokenness is computed server-side against the body on every
      // read, so a body edit can break or repair spans without touching a span
      // row. Without this the lost-anchor panel only catches up after the
      // query goes stale.
      await queryClient.invalidateQueries({
        queryKey: authoringKeys.lessonTextSpans(lessonId, defaultVariant.id),
      });
    }
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

  const bodyField = register('body', { onChange: () => autosave.schedule() });
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  function handleFormat(format: MarkdownFormat) {
    const el = bodyRef.current;
    if (!el) return;
    const next = applyMarkdownFormat(format, el.value, el.selectionStart, el.selectionEnd);
    setValue('body', next.value, { shouldDirty: true });
    autosave.schedule();
    // Restore focus and selection after React commits the new value.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.selStart, next.selEnd);
    });
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
        <TextLessonPreview
          title={titleValue ?? ''}
          body={bodyValue ?? ''}
          glossary={glossary}
          lang={lesson.data?.targetLanguage}
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

          <EditorCard
            title={t('editor.anchorText')}
            right={
              <div className="flex items-center gap-1.5">
                <MarkdownFormatMenu onInsert={handleFormat} />
                <TextSpanMenu
                  lessonId={lessonId}
                  variantId={defaultVariant?.id}
                  container={container}
                  grammarRules={grammarRules}
                  body={bodyValue ?? ''}
                  textareaRef={bodyRef}
                />
                <GlossaryMarkButton
                  lessonId={lessonId}
                  variantId={defaultVariant?.id}
                  container={container}
                />
              </div>
            }
          >
            <Textarea
              id="lesson-body"
              rows={14}
              placeholder={t('lessons.bodyPlaceholder')}
              className="font-reading text-[15px] leading-loose"
              {...bodyField}
              ref={(el) => {
                bodyField.ref(el);
                bodyRef.current = el;
              }}
            />
            <TextSpanList
              lessonId={lessonId}
              variantId={defaultVariant?.id}
              container={container}
              grammarRules={grammarRules}
            />
            <GlossaryMarkedWords
              lessonId={lessonId}
              variantId={defaultVariant?.id}
              container={container}
            />
          </EditorCard>

          <HeroImageSlot
            body={bodyValue ?? ''}
            altDefault={titleValue || lessonTitle || ''}
            onChange={handleBodyTokenChange}
          />

          <AudioNarrationRow body={bodyValue ?? ''} onChange={handleBodyTokenChange} />

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

          <ParagraphTranslationsPanel lessonId={lessonId} variantId={defaultVariant?.id} />

          {/* The check the reader meets after the text, on the same staging
              model an AUDIO lesson uses after its transcript (spec 17). */}
          <ListeningStageListEditor
            lessonId={lessonId}
            variantId={defaultVariant?.id}
            container={container}
            surface="text"
          />
        </div>
      )}
    </LessonEditorShell>
  );
}
