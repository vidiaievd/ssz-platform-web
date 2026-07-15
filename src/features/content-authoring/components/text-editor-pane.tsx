'use client';

import type { ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { Container } from '@/features/content/types';
import type { MaterialKind } from '@/lib/content/lesson-types';

import { lessonFormSchema, type LessonFormValues } from '../schemas/lesson';
import { updateLessonAction } from '../actions/lesson';
import { useLessonVariants } from '../api/use-authoring-lessons';
import { authoringKeys } from '../api/keys';
import { useAutosave } from '../hooks/use-autosave';
import { LessonEditorShell } from './lesson-editor-shell';
import { EditorCard } from './editor-card';
import { TextLessonPreview } from './text-lesson-preview';
import { ParagraphTranslationsPanel } from './paragraph-translations-panel';
import { GlossaryMarkPanel } from './glossary-mark-panel';
import { HeroImageSlot } from './hero-image-slot';

interface TextEditorPaneProps {
  kind: MaterialKind;
  lessonId: string;
  lessonTitle: string | null;
  state: 'draft' | 'published' | null;
  container: Container;
  backHref: string;
  publishSlot: ReactNode;
}

export function TextEditorPane({
  kind,
  lessonId,
  lessonTitle,
  state,
  container,
  backHref,
  publishSlot,
}: TextEditorPaneProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();

  const { data: variants, isLoading: variantsLoading } = useLessonVariants(lessonId);
  const defaultVariant = variants?.[0];

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

  return (
    <LessonEditorShell
      kind={kind}
      title={titleValue || lessonTitle || t('lessons.untitled')}
      state={state}
      backHref={backHref}
      autosaveStatus={autosave.status}
      autosaveSavedAt={autosave.savedAt}
      publishSlot={publishSlot}
      preview={<TextLessonPreview title={titleValue ?? ''} body={bodyValue ?? ''} />}
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

          <EditorCard title={t('editor.anchorText')}>
            <Textarea
              id="lesson-body"
              rows={14}
              placeholder={t('lessons.bodyPlaceholder')}
              className="font-reading text-[15px] leading-loose"
              {...register('body', { onChange: () => autosave.schedule() })}
            />
          </EditorCard>

          <HeroImageSlot
            body={bodyValue ?? ''}
            altDefault={titleValue || lessonTitle || ''}
            onChange={(newBody) => {
              setValue('body', newBody);
              autosave.schedule();
            }}
          />

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

          <GlossaryMarkPanel lessonId={lessonId} variantId={defaultVariant?.id} container={container} />
        </div>
      )}
    </LessonEditorShell>
  );
}
