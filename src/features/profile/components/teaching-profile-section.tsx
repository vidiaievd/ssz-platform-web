'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { useMyTutorProfile, useUpdateTutorProfile } from '../api/use-my-tutor-profile';
import {
  useMyTeachingProfile,
  useAddTeachingLanguage,
  useRemoveTeachingLanguage,
  useEnsureTeachingProfile,
} from '../api/use-my-teaching-profile';
import { profileKeys } from '../api/keys';
import { TeachingLanguageEditor } from './teaching-language-editor';

type Props = {
  showRate?: boolean;
};

export function TeachingProfileSection({ showRate = false }: Props) {
  const t = useTranslations('Profile');
  const tErr = useTranslations('Errors');
  const queryClient = useQueryClient();

  const { data: teaching, isLoading: teachingLoading } = useMyTeachingProfile();
  const { data: tutor, isLoading: tutorLoading } = useMyTutorProfile();
  const addLang = useAddTeachingLanguage();
  const removeLang = useRemoveTeachingLanguage();
  const ensureProfile = useEnsureTeachingProfile();
  const updateTutor = useUpdateTutorProfile();

  const [rate, setRate] = useState('');
  const [currency, setCurrency] = useState('');
  const [isPending, startTransition] = useTransition();

  async function handleAdd(code: string, level: string) {
    if (!teaching) await ensureProfile.mutateAsync();
    await addLang.mutateAsync({ code, level });
  }

  function handleRemove(code: string) {
    startTransition(async () => {
      try {
        await removeLang.mutateAsync(code);
      } catch {
        toast.error(tErr('unknown'));
      }
    });
  }

  function saveRate() {
    const parsed = parseFloat(rate);
    if (isNaN(parsed) || parsed < 0) return;
    startTransition(async () => {
      try {
        await updateTutor.mutateAsync({ hourlyRate: parsed, currency: currency || tutor?.currency || 'USD' });
        await queryClient.invalidateQueries({ queryKey: profileKeys.tutorMe() });
        toast.success(t('saveSuccess'));
      } catch {
        toast.error(tErr('unknown'));
      }
    });
  }

  if (teachingLoading || (showRate && tutorLoading)) {
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
          disabled={isPending}
        />
      </div>

      {showRate && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <Field label={t('teaching.rate')} htmlFor="hourly-rate">
              <Input
                id="hourly-rate"
                type="number"
                min="0"
                step="0.01"
                placeholder={tutor?.hourlyRate?.toString() ?? '0'}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                disabled={isPending}
              />
            </Field>
            <Field label={t('teaching.currency')} htmlFor="currency">
              <Input
                id="currency"
                placeholder={tutor?.currency ?? 'USD'}
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                disabled={isPending}
              />
            </Field>
          </div>
          <Button type="button" variant="outline" onClick={saveRate} loading={isPending}>
            {t('save')}
          </Button>
        </div>
      )}
    </section>
  );
}
