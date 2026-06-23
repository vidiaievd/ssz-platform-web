'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
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

import { grammarEditorFormSchema, type GrammarEditorFormValues } from '../schemas/grammar';
import { updateGrammarRuleAction, saveGrammarExplanationAction } from '../actions/grammar';
import { useAuthoringGrammarExplanations } from '../api/use-authoring-grammar';
import { authoringKeys } from '../api/keys';
import { useAutosave } from '../hooks/use-autosave';
import { AutosaveIndicator } from './autosave-indicator';

interface GrammarEditorProps {
  ruleId: string;
  ruleTitle: string;
  container: Container;
  onClose: () => void;
}

export function GrammarEditor({ ruleId, ruleTitle, container, onClose }: GrammarEditorProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [previewHtml, setPreviewHtml] = useState('');
  const [localExplanationId, setLocalExplanationId] = useState<string | null>(null);

  const { data: explanations, isLoading } = useAuthoringGrammarExplanations(ruleId);
  const defaultExplanation = explanations?.[0];
  const explanationId = localExplanationId ?? defaultExplanation?.id ?? null;

  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    formState: { errors },
  } = useForm<GrammarEditorFormValues>({
    resolver: zodResolver(grammarEditorFormSchema),
    defaultValues: {
      ruleTitle,
      languageCode: 'en',
      explanationTitle: '',
      body: '',
      examples: [],
    },
    values: defaultExplanation
      ? {
          ruleTitle,
          languageCode: defaultExplanation.languageCode,
          explanationTitle: defaultExplanation.title,
          body: defaultExplanation.body,
          examples: (defaultExplanation.examples ?? []).map((text) => ({ text })),
        }
      : undefined,
  });

  const { fields: exampleFields, append: appendExample, remove: removeExample } = useFieldArray({
    control,
    name: 'examples',
  });

  const bodyValue = watch('body');

  const autosave = useAutosave({
    onSave: async () => {
      const { languageCode, explanationTitle, body, examples } = getValues();
      const result = await saveGrammarExplanationAction(
        ruleId,
        explanationId,
        container.id,
        container.difficultyLevel,
        { languageCode, title: explanationTitle, body, examples },
      );
      if (!result.ok) throw new Error(result.error.code);
      if (result.value?.explanationId) setLocalExplanationId(result.value.explanationId);
      await queryClient.invalidateQueries({ queryKey: authoringKeys.grammarExplanations(ruleId) });
    },
    debounceMs: 1500,
  });

  useEffect(() => {
    if (editorTab !== 'preview' || !bodyValue) {
      setPreviewHtml('');
      return;
    }
    unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeSanitize)
      .use(rehypeStringify)
      .process(bodyValue)
      .then((r) => setPreviewHtml(String(r)))
      .catch((err) => {
        console.error('[grammar-editor] preview render failed:', err);
        setPreviewHtml('<p style="color:var(--destructive)">Preview unavailable</p>');
      });
  }, [bodyValue, editorTab]);

  function onSubmit(data: GrammarEditorFormValues) {
    autosave.cancel();
    startTransition(async () => {
      const r1 = await updateGrammarRuleAction(ruleId, container.id, { title: data.ruleTitle });
      if (!r1.ok) {
        toast.error(tErrors(r1.error.code));
        return;
      }
      const r2 = await saveGrammarExplanationAction(
        ruleId,
        explanationId,
        container.id,
        container.difficultyLevel,
        {
          languageCode: data.languageCode,
          title: data.explanationTitle,
          body: data.body,
          examples: data.examples,
        },
      );
      if (!r2.ok) {
        toast.error(tErrors(r2.error.code));
        return;
      }
      if (r2.value?.explanationId) setLocalExplanationId(r2.value.explanationId);
      await queryClient.invalidateQueries({
        queryKey: authoringKeys.grammarRules(container.id),
      });
      await queryClient.invalidateQueries({
        queryKey: authoringKeys.grammarExplanations(ruleId),
      });
      autosave.markSaved();
      toast.success(t('grammar.saveSuccess'));
    });
  }

  if (isLoading) {
    return (
      <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">{t('grammar.editingLabel')}</h3>
        <div className="flex items-center gap-3">
          <AutosaveIndicator status={autosave.status} savedAt={autosave.savedAt} />
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            {t('lessons.closeEditor')}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Rule title */}
        <Field
          label={t('fields.title')}
          htmlFor="gr-rule-title"
          error={errors.ruleTitle?.message}
          required
        >
          <Input
            id="gr-rule-title"
            placeholder={t('grammar.ruleTitlePlaceholder')}
            hasError={!!errors.ruleTitle}
            disabled={isPending}
            {...register('ruleTitle')}
          />
        </Field>

        <div className="rounded-md border border-border p-3">
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
            {t('grammar.explanationSection')}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('grammar.explanationLang')}
              htmlFor="gr-lang"
              error={errors.languageCode?.message}
              required
            >
              <Input
                id="gr-lang"
                placeholder="en"
                hasError={!!errors.languageCode}
                disabled={isPending}
                {...register('languageCode')}
              />
            </Field>
            <Field
              label={t('grammar.explanationTitle')}
              htmlFor="gr-exp-title"
              error={errors.explanationTitle?.message}
              required
            >
              <Input
                id="gr-exp-title"
                placeholder={t('grammar.explanationTitlePlaceholder')}
                hasError={!!errors.explanationTitle}
                disabled={isPending}
                {...register('explanationTitle')}
              />
            </Field>
          </div>

          {/* Body with write/preview tabs */}
          <div className="mt-4 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-(--ssz-text-primary)">
              {t('lessons.body')}
            </label>
            <Tabs
              value={editorTab}
              onValueChange={(v) => setEditorTab(v as 'write' | 'preview')}
            >
              <TabsList>
                <TabsTrigger value="write">{t('lessons.tabWrite')}</TabsTrigger>
                <TabsTrigger value="preview">{t('lessons.tabPreview')}</TabsTrigger>
              </TabsList>
              <TabsContent value="write">
                <Textarea
                  rows={10}
                  placeholder={t('grammar.bodyPlaceholder')}
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

          {/* Examples */}
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-(--ssz-text-primary)">
              {t('grammar.examples')}
            </p>
            {exampleFields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    placeholder={t('grammar.examplePlaceholder')}
                    hasError={!!errors.examples?.[index]?.text}
                    disabled={isPending}
                    {...register(`examples.${index}.text`)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeExample(index)}
                  aria-label={t('grammar.removeExample')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => appendExample({ text: '' })}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t('grammar.addExample')}
            </Button>
          </div>
        </div>

        <Button type="submit" loading={isPending}>
          {t('form.save')}
        </Button>
      </form>
    </div>
  );
}
