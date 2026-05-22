'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
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

interface LessonEditorProps {
  lessonId: string;
  lessonTitle?: string;
  container: Container;
  onClose: () => void;
}

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function LessonEditor({ lessonId, lessonTitle, container, onClose }: LessonEditorProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [previewHtml, setPreviewHtml] = useState('');
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: variants, isLoading: variantsLoading } = useLessonVariants(lessonId);
  const defaultVariant = variants?.[0];

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors },
  } = useForm<LessonFormValues>({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: {
      title: lessonTitle ?? '',
      body: '',
    },
    values: defaultVariant
      ? { title: defaultVariant.title, body: defaultVariant.body }
      : lessonTitle
        ? { title: lessonTitle, body: '' }
        : undefined,
  });

  const bodyValue = watch('body');

  // Cleanup autosave timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
    };
  }, []);

  // Render markdown preview only when preview tab is active
  useEffect(() => {
    if (editorTab !== 'preview') return;
    if (!bodyValue) {
      setPreviewHtml('');
      return;
    }
    unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeSanitize)
      .use(rehypeStringify)
      .process(bodyValue)
      .then((result) => setPreviewHtml(String(result)))
      .catch(() => setPreviewHtml(''));
  }, [bodyValue, editorTab]);

  function scheduleAutosave() {
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => {
      void performSave(getValues());
    }, 1500);
  }

  async function performSave(data: LessonFormValues) {
    setAutosaveStatus('saving');
    const result = await updateLessonAction(
      lessonId,
      container.id,
      defaultVariant?.id ?? null,
      container.targetLanguage,
      data,
    );
    if (!result.ok) {
      setAutosaveStatus('error');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: authoringKeys.lessonVariants(lessonId) });
    setAutosaveStatus('saved');
  }

  function onSubmit(data: LessonFormValues) {
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    startTransition(async () => {
      const result = await updateLessonAction(
        lessonId,
        container.id,
        defaultVariant?.id ?? null,
        container.targetLanguage,
        data,
      );
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.lessonVariants(lessonId) });
      setAutosaveStatus('saved');
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
          {autosaveStatus === 'saving' && (
            <span className="text-muted-foreground text-xs">{t('lessons.autosaving')}</span>
          )}
          {autosaveStatus === 'saved' && (
            <span className="text-xs text-green-600 dark:text-green-400">{t('lessons.autosaved')}</span>
          )}
          {autosaveStatus === 'error' && (
            <span className="text-xs text-destructive">{t('lessons.autosaveError')}</span>
          )}
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
                  onChange: () => {
                    setAutosaveStatus('idle');
                    scheduleAutosave();
                  },
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
