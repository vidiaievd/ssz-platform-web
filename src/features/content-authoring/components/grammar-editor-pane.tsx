'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { Container } from '@/features/content/types';
import type { MaterialKind } from '@/lib/content/lesson-types';

import { grammarEditorFormSchema, type GrammarEditorFormValues } from '../schemas/grammar';
import { updateGrammarRuleAction, saveGrammarExplanationAction } from '../actions/grammar';
import { useAuthoringGrammarExplanations } from '../api/use-authoring-grammar';
import { authoringKeys } from '../api/keys';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { LessonEditorShell } from './lesson-editor-shell';
import { useSaveScopeText } from './save-scope';
import { EditorCard } from './editor-card';
import { GrammarLessonPreview } from './grammar-lesson-preview';

interface GrammarEditorPaneProps {
  kind: MaterialKind;
  ruleId: string;
  ruleTitle: string | null;
  state: 'draft' | 'published' | null;
  /** Whether students can open this material right now — see `SaveScopeContext`. */
  isLive: boolean | null;
  container: Container;
  backHref: string;
  publishSlot: ReactNode;
}

export function GrammarEditorPane({
  kind,
  ruleId,
  ruleTitle,
  state,
  isLive,
  container,
  backHref,
  publishSlot,
}: GrammarEditorPaneProps) {
  const t = useTranslations('Authoring');
  const saveScope = useSaveScopeText(isLive);
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [localExplanationId, setLocalExplanationId] = useState<string | null>(null);

  const { data: explanations, isLoading } = useAuthoringGrammarExplanations(ruleId);
  const defaultExplanation = explanations?.[0];
  const explanationId = localExplanationId ?? defaultExplanation?.id ?? null;

  const {
    register,
    control,
    getValues,
    formState: { errors },
  } = useForm<GrammarEditorFormValues>({
    resolver: zodResolver(grammarEditorFormSchema),
    defaultValues: {
      ruleTitle: ruleTitle ?? '',
      languageCode: 'en',
      explanationTitle: '',
      body: '',
      examples: [],
    },
    values: defaultExplanation
      ? {
          ruleTitle: ruleTitle ?? '',
          languageCode: defaultExplanation.languageCode,
          explanationTitle: defaultExplanation.title,
          body: defaultExplanation.body,
          examples: (defaultExplanation.examples ?? []).map((text) => ({ text })),
        }
      : undefined,
  });

  const {
    fields: exampleFields,
    append: appendExample,
    remove: removeExample,
  } = useFieldArray({ control, name: 'examples' });

  const ruleTitleValue = useWatch({ control, name: 'ruleTitle' });
  const bodyValue = useWatch({ control, name: 'body' });
  const examplesValue = useWatch({ control, name: 'examples' });

  async function saveAll(data: GrammarEditorFormValues) {
    const r1 = await updateGrammarRuleAction(ruleId, container.id, { title: data.ruleTitle });
    if (!r1.ok) return r1;

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
    if (!r2.ok) return r2;
    if (r2.value?.explanationId) setLocalExplanationId(r2.value.explanationId);

    await queryClient.invalidateQueries({ queryKey: authoringKeys.grammarRules(container.id) });
    await queryClient.invalidateQueries({ queryKey: authoringKeys.grammarExplanations(ruleId) });
    return r2;
  }

  const unsaved = useUnsavedChanges();

  return (
    <LessonEditorShell
      kind={kind}
      title={ruleTitleValue || ruleTitle || t('lessons.untitled')}
      state={state}
      isLive={isLive}
      backHref={backHref}
      saveStatus={unsaved.status}
      savedAt={unsaved.savedAt}
      publishSlot={publishSlot}
      preview={
        <GrammarLessonPreview
          title={ruleTitleValue ?? ''}
          body={bodyValue ?? ''}
          examples={(examplesValue ?? []).map((e) => e.text)}
        />
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
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
              {...register('ruleTitle', { onChange: () => unsaved.markDirty() })}
            />
          </Field>

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
                {...register('languageCode', { onChange: () => unsaved.markDirty() })}
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
                {...register('explanationTitle', { onChange: () => unsaved.markDirty() })}
              />
            </Field>
          </div>

          <EditorCard title={t('grammar.explanationSection')}>
            <Textarea
              rows={6}
              placeholder={t('grammar.bodyPlaceholder')}
              disabled={isPending}
              {...register('body', { onChange: () => unsaved.markDirty() })}
            />
          </EditorCard>

          <EditorCard
            title={t('grammar.examples')}
            right={
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => appendExample({ text: '' })}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {t('grammar.addExample')}
              </Button>
            }
          >
            {exampleFields.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                {t('grammar.examplesEmpty')}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {exampleFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-2 rounded-[11px] border border-border bg-(--ssz-bg-base) p-2.5"
                  >
                    <div className="flex-1">
                      <Input
                        placeholder={t('grammar.examplePlaceholder')}
                        hasError={!!errors.examples?.[index]?.text}
                        disabled={isPending}
                        {...register(`examples.${index}.text`, {
                          onChange: () => unsaved.markDirty(),
                        })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        removeExample(index);
                        unsaved.markDirty();
                      }}
                      aria-label={t('grammar.removeExample')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </EditorCard>

          <Button
            type="button"
            onClick={() => {
              startTransition(async () => {
                const result = await saveAll(getValues());
                if (!result.ok) {
                  toast.error(tErrors(result.error.code));
                  return;
                }
                unsaved.markSaved();
                toast.success(t('grammar.saveSuccess'), { description: saveScope });
              });
            }}
            loading={isPending}
          >
            {t('form.save')}
          </Button>
        </div>
      )}
    </LessonEditorShell>
  );
}
