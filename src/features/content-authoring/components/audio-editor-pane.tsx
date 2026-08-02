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
import { useLessonVariants, useListeningStages } from '../api/use-authoring-lessons';
import { authoringKeys } from '../api/keys';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { LessonEditorShell } from './lesson-editor-shell';
import { EditorCard } from './editor-card';
import { AudioSourceSlot } from './audio-source-slot';
import { AudioLessonPreview } from './audio-lesson-preview';
import { ListeningStageListEditor } from './listening-stage-list-editor';

interface AudioEditorPaneProps {
  kind: MaterialKind;
  lessonId: string;
  lessonTitle: string | null;
  state: 'draft' | 'published' | null;
  container: Container;
  backHref: string;
  publishSlot: ReactNode;
}

export function AudioEditorPane({
  kind,
  lessonId,
  lessonTitle,
  state,
  container,
  backHref,
  publishSlot,
}: AudioEditorPaneProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();

  const { data: variants, isLoading: variantsLoading } = useLessonVariants(lessonId);
  const defaultVariant = variants?.[0];
  const { data: stages } = useListeningStages(lessonId, defaultVariant?.id);

  const {
    register,
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<LessonFormValues>({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: { title: lessonTitle ?? '', body: '', transcript: '' },
    values: defaultVariant
      ? {
          title: defaultVariant.displayTitle,
          body: defaultVariant.bodyMarkdown,
          transcript: defaultVariant.transcript ?? '',
        }
      : lessonTitle
        ? { title: lessonTitle, body: '', transcript: '' }
        : undefined,
  });

  const titleValue = useWatch({ control, name: 'title' });
  const bodyValue = useWatch({ control, name: 'body' });
  const transcriptValue = useWatch({ control, name: 'transcript' });

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

  const unsaved = useUnsavedChanges();

  function handleBodyTokenChange(newBody: string) {
    setValue('body', newBody);
    unsaved.markDirty();
  }

  return (
    <LessonEditorShell
      kind={kind}
      title={titleValue || lessonTitle || t('lessons.untitled')}
      state={state}
      backHref={backHref}
      saveStatus={unsaved.status}
      savedAt={unsaved.savedAt}
      publishSlot={publishSlot}
      preview={
        <AudioLessonPreview
          title={titleValue ?? ''}
          body={bodyValue ?? ''}
          transcript={transcriptValue ?? ''}
          stages={stages ?? []}
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
          <Field
            label={t('fields.title')}
            htmlFor="lesson-title"
            error={errors.title?.message}
            required
          >
            <Input
              id="lesson-title"
              placeholder={t('lessons.titlePlaceholder')}
              hasError={!!errors.title}
              {...register('title', { onChange: () => unsaved.markDirty() })}
            />
          </Field>

          <AudioSourceSlot body={bodyValue ?? ''} onChange={handleBodyTokenChange} />

          <EditorCard title={t('editor.transcript')}>
            <Textarea
              rows={8}
              placeholder={t('editor.transcriptPlaceholder')}
              {...register('transcript', { onChange: () => unsaved.markDirty() })}
            />
          </EditorCard>

          <Button
            type="button"
            onClick={() => {
              void (async () => {
                const result = await saveLesson(getValues());
                if (!result.ok) {
                  toast.error(tErrors(result.error.code));
                  return;
                }
                unsaved.markSaved();
                toast.success(t('lessons.saveSuccess'));
              })();
            }}
          >
            {t('form.save')}
          </Button>

          <ListeningStageListEditor
            lessonId={lessonId}
            variantId={defaultVariant?.id}
            container={container}
          />
        </div>
      )}
    </LessonEditorShell>
  );
}
