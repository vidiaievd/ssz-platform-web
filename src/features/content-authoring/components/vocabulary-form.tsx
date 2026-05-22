'use client';

import { useState, useTransition } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { vocabularyItemFormSchema, type VocabularyItemFormValues } from '../schemas/vocabulary';
import { saveVocabularyItemAction } from '../actions/vocabulary';
import { useAuthoringVocabularyItem } from '../api/use-authoring-vocabulary';
import { authoringKeys } from '../api/keys';

interface VocabularyFormProps {
  listId: string;
  containerId: string;
  itemId?: string;
  onDone: () => void;
}

export function VocabularyForm({ listId, containerId, itemId, onDone }: VocabularyFormProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [removedTranslationLangs, setRemovedTranslationLangs] = useState<string[]>([]);
  const [removedExampleIds, setRemovedExampleIds] = useState<string[]>([]);

  const { data: existingItem, isLoading } = useAuthoringVocabularyItem(
    listId,
    itemId ?? null,
    !!itemId,
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<VocabularyItemFormValues>({
    resolver: zodResolver(vocabularyItemFormSchema),
    values: existingItem
      ? {
          lemma: existingItem.lemma,
          ipa: existingItem.ipa ?? '',
          partOfSpeech: existingItem.partOfSpeech ?? '',
          translations: existingItem.translations.map((t) => ({
            languageCode: t.languageCode,
            translation: t.translation,
          })),
          examples: existingItem.examples.map((e) => ({
            serverId: e.id,
            template: e.template,
            substitution: e.substitution ?? '',
          })),
        }
      : undefined,
    defaultValues: {
      lemma: '',
      ipa: '',
      partOfSpeech: '',
      translations: [],
      examples: [],
    },
  });

  const {
    fields: translationFields,
    append: appendTranslation,
    remove: removeTranslation,
  } = useFieldArray({ control, name: 'translations' });

  const {
    fields: exampleFields,
    append: appendExample,
    remove: removeExample,
  } = useFieldArray({ control, name: 'examples' });

  function handleRemoveTranslation(index: number) {
    const lang = translationFields[index]?.languageCode;
    if (lang && existingItem?.translations.some((tr) => tr.languageCode === lang)) {
      setRemovedTranslationLangs((prev) => [...prev, lang]);
    }
    removeTranslation(index);
  }

  function handleRemoveExample(index: number) {
    const sid = exampleFields[index]?.serverId;
    if (sid) setRemovedExampleIds((prev) => [...prev, sid]);
    removeExample(index);
  }

  function onSubmit(data: VocabularyItemFormValues) {
    startTransition(async () => {
      const result = await saveVocabularyItemAction(
        listId,
        itemId ?? null,
        containerId,
        data,
        { translationLangs: removedTranslationLangs, exampleIds: removedExampleIds },
      );
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.vocabularyItems(listId) });
      toast.success(t('vocabulary.saveSuccess'));
      onDone();
    });
  }

  if (isLoading && itemId) {
    return (
      <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-4 text-sm font-medium">
        {itemId ? t('vocabulary.editWord') : t('vocabulary.addWord')}
      </h3>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Core word fields */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={t('vocabulary.lemma')}
            htmlFor="v-lemma"
            error={errors.lemma?.message}
            required
          >
            <Input
              id="v-lemma"
              placeholder={t('vocabulary.lemmaPlaceholder')}
              hasError={!!errors.lemma}
              disabled={isPending}
              {...register('lemma')}
            />
          </Field>
          <Field label={t('vocabulary.ipa')} htmlFor="v-ipa" error={errors.ipa?.message}>
            <Input
              id="v-ipa"
              placeholder="/ˈsʏk·əl/"
              hasError={!!errors.ipa}
              disabled={isPending}
              {...register('ipa', { setValueAs: (v: string) => v || undefined })}
            />
          </Field>
          <Field
            label={t('vocabulary.partOfSpeech')}
            htmlFor="v-pos"
            error={errors.partOfSpeech?.message}
          >
            <Input
              id="v-pos"
              placeholder={t('vocabulary.partOfSpeechPlaceholder')}
              hasError={!!errors.partOfSpeech}
              disabled={isPending}
              {...register('partOfSpeech', { setValueAs: (v: string) => v || undefined })}
            />
          </Field>
        </div>

        {/* Translations */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-(--ssz-text-primary)">
            {t('vocabulary.translations')}
          </p>
          {translationFields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              <div className="w-20 shrink-0">
                <Input
                  placeholder={t('vocabulary.langCode')}
                  hasError={!!errors.translations?.[index]?.languageCode}
                  disabled={isPending}
                  {...register(`translations.${index}.languageCode`)}
                />
              </div>
              <div className="flex-1">
                <Input
                  placeholder={t('vocabulary.translationText')}
                  hasError={!!errors.translations?.[index]?.translation}
                  disabled={isPending}
                  {...register(`translations.${index}.translation`)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveTranslation(index)}
                aria-label={t('vocabulary.removeTranslation')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => appendTranslation({ languageCode: '', translation: '' })}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t('vocabulary.addTranslation')}
          </Button>
        </div>

        {/* Examples */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-(--ssz-text-primary)">
            {t('vocabulary.examples')}
          </p>
          <p className="text-muted-foreground text-xs">{t('vocabulary.examplesHint')}</p>
          {exampleFields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              <input type="hidden" {...register(`examples.${index}.serverId`)} />
              <div className="flex-1">
                <Input
                  placeholder={t('vocabulary.templatePlaceholder')}
                  hasError={!!errors.examples?.[index]?.template}
                  disabled={isPending}
                  {...register(`examples.${index}.template`)}
                />
              </div>
              <div className="w-36 shrink-0">
                <Input
                  placeholder={t('vocabulary.substitutionPlaceholder')}
                  hasError={!!errors.examples?.[index]?.substitution}
                  disabled={isPending}
                  {...register(`examples.${index}.substitution`)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveExample(index)}
                aria-label={t('vocabulary.removeExample')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => appendExample({ serverId: undefined, template: '', substitution: '' })}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t('vocabulary.addExample')}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button type="submit" loading={isPending}>
            {t('form.save')}
          </Button>
          <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
            {t('lessons.deleteCancel')}
          </Button>
        </div>
      </form>
    </div>
  );
}
