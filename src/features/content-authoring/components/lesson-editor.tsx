'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import type { Container } from '@/features/content/types';

import { lessonFormSchema, type LessonFormValues } from '../schemas/lesson';
import { updateLessonAction } from '../actions/lesson';
import { useLessonVariants } from '../api/use-authoring-lessons';
import { authoringKeys } from '../api/keys';
import { useAutosave } from '../hooks/use-autosave';
import { AutosaveIndicator } from './autosave-indicator';

interface LessonEditorProps {
  lessonId: string;
  lessonTitle?: string;
  container: Container;
  onClose: () => void;
}

export function LessonEditor({ lessonId, lessonTitle, container, onClose }: LessonEditorProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [previewHtml, setPreviewHtml] = useState('');

  const { data: variants, isLoading: variantsLoading } = useLessonVariants(lessonId);
  const defaultVariant = variants?.[0];

  const {
    register,
    handleSubmit,
    control,
    getValues,
    formState: { errors },
  } = useForm<LessonFormValues>({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: {
      title: lessonTitle ?? '',
      body: '',
    },
    values: defaultVariant
      ? { title: defaultVariant.displayTitle, body: defaultVariant.bodyMarkdown }
      : lessonTitle
        ? { title: lessonTitle, body: '' }
        : undefined,
  });

  const bodyValue = useWatch({ control, name: 'body' });

  const autosave = useAutosave({
    onSave: async () => {
      const data = getValues();
      const result = await updateLessonAction(
        lessonId,
        container.id,
        defaultVariant?.id ?? null,
        container.difficultyLevel,
        data,
      );
      if (!result.ok) throw new Error(result.error.code);
      await queryClient.invalidateQueries({ queryKey: authoringKeys.lessonVariants(lessonId) });
    },
    debounceMs: 800,
  });

  useEffect(() => {
    void (async () => {
      if (editorTab !== 'preview') return;
      if (!bodyValue) {
        setPreviewHtml('');
        return;
      }
      try {
        const result = await unified()
          .use(remarkParse)
          .use(remarkRehype)
          .use(rehypeSanitize)
          .use(rehypeStringify)
          .process(bodyValue);
        setPreviewHtml(String(result));
      } catch (err) {
        console.error('[lesson-editor] preview render failed:', err);
        setPreviewHtml('<p style="color:var(--destructive)">Preview unavailable</p>');
      }
    })();
  }, [bodyValue, editorTab]);

  function onSubmit(data: LessonFormValues) {
    autosave.cancel();
    startTransition(async () => {
      const result = await updateLessonAction(
        lessonId,
        container.id,
        defaultVariant?.id ?? null,
        container.difficultyLevel,
        data,
      );
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.lessonVariants(lessonId) });
      autosave.markSaved();
      toast.success(t('lessons.saveSuccess'));
    });
  }

  if (variantsLoading) {
    return (
      <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">{t('lessons.editingLabel')}</h3>
        <div className="flex items-center gap-3">
          <AutosaveIndicator status={autosave.status} savedAt={autosave.savedAt} />
          <Button variant="ghost" size="sm" onClick={onClose} type="button">
            {t('lessons.closeEditor')}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label={t('fields.title')} htmlFor="lesson-title" error={errors.title?.message} required>
          <Input
            id="lesson-title"
            placeholder={t('lessons.titlePlaceholder')}
            hasError={!!errors.title}
            disabled={isPending}
            {...register('title')}
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-(--ssz-text-primary)">
            {t('lessons.body')}
          </label>
          <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as 'write' | 'preview')}>
            <TabsList>
              <TabsTrigger value="write">{t('lessons.tabWrite')}</TabsTrigger>
              <TabsTrigger value="preview">{t('lessons.tabPreview')}</TabsTrigger>
            </TabsList>
            <TabsContent value="write">
              <Textarea
                id="lesson-body"
                rows={12}
                placeholder={t('lessons.bodyPlaceholder')}
                className="font-mono text-sm"
                disabled={isPending}
                {...register('body', {
                  onChange: () => autosave.schedule(),
                })}
              />
            </TabsContent>
            <TabsContent value="preview">
              {previewHtml ? (
                <div
                  className="prose dark:prose-invert min-h-32 max-w-none rounded-md border border-border p-3 text-sm"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <p className="text-muted-foreground min-h-32 rounded-md border border-border p-3 text-sm italic">
                  {t('lessons.previewEmpty')}
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <Button type="submit" loading={isPending}>
          {t('form.save')}
        </Button>
      </form>
    </div>
  );
}
