'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useMyTeachingProfile,
  useAddTeachingLanguage,
  useRemoveTeachingLanguage,
  useEnsureTeachingProfile,
} from '../api/use-my-teaching-profile';
import { TeachingLanguageEditor } from './teaching-language-editor';
import { useProfileSettingsForm } from '../hooks/use-profile-settings-form';

type Props = {
  showRate?: boolean;
};

export function TeachingProfileSection({ showRate = false }: Props) {
  const t = useTranslations('Profile');
  const tErr = useTranslations('Errors');

  const { data: teaching, isLoading: teachingLoading } = useMyTeachingProfile();
  const { form, isPending, isLoading: formLoading } = useProfileSettingsForm();
  const addLang = useAddTeachingLanguage();
  const removeLang = useRemoveTeachingLanguage();
  const ensureProfile = useEnsureTeachingProfile();

  const [langPending, startLangTransition] = useTransition();

  const { register, formState: { errors } } = form;

  async function handleAdd(code: string, level: string) {
    if (!teaching) await ensureProfile.mutateAsync();
    await addLang.mutateAsync({ code, level });
  }

  function handleRemove(code: string) {
    startLangTransition(async () => {
      try {
        await removeLang.mutateAsync(code);
      } catch {
        toast.error(tErr('unknown'));
      }
    });
  }

  if (teachingLoading || (showRate && formLoading)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <h2 className="text-base font-semibold">{t('sections.teaching')}</h2>

      <div className="space-y-3">
        <p className="text-sm font-medium text-(--ssz-text-primary)">{t('teaching.languages')}</p>
        <TeachingLanguageEditor
          languages={teaching?.languages ?? []}
          onAdd={handleAdd}
          onRemove={handleRemove}
          addLabel={t('teaching.addLanguage')}
          removeLabelFn={(code) => t('teaching.removeLanguage', { code })}
          languagePlaceholder={t('teaching.languagePlaceholder')}
          levelPlaceholder={t('teaching.cefrPlaceholder')}
          disabled={langPending}
        />
      </div>

      {showRate && (
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <Field
            label={t('teaching.rate')}
            htmlFor="hourly-rate"
            error={errors.hourlyRate?.message}
          >
            <Input
              id="hourly-rate"
              type="number"
              min="0"
              step="0.01"
              disabled={isPending}
              {...register('hourlyRate', {
                setValueAs: (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
              })}
            />
          </Field>
          <Field
            label={t('teaching.currency')}
            htmlFor="currency"
            error={errors.currency?.message}
          >
            <Input
              id="currency"
              maxLength={3}
              disabled={isPending}
              {...register('currency', {
                setValueAs: (v: string | null) =>
                  !v || v.trim() === '' ? null : v.trim().toUpperCase(),
              })}
            />
          </Field>
        </div>
      )}
    </section>
  );
}
