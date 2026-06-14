'use client';

import { useState, useTransition } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CEFR_LEVELS } from '../lib/cefr-levels';
import { LanguageCombobox } from './onboarding/language-combobox';
import { useMyTutorProfile, useUpdateTutorProfile } from '../api/use-my-tutor-profile';
import { profileKeys } from '../api/keys';

type Props = {
  /** Show hourly rate fields — only for private tutors, not school teachers */
  showRate?: boolean;
};

export function TeachingProfileSection({ showRate = false }: Props) {
  const t = useTranslations('Profile');
  const tErr = useTranslations('Errors');
  const { data: tutor, isLoading } = useMyTutorProfile();
  const updateTutor = useUpdateTutorProfile();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const [newLang, setNewLang] = useState('');
  const [rate, setRate] = useState('');
  const [currency, setCurrency] = useState('');

  const teachingLanguages: string[] = tutor?.teachingLanguages ?? [];

  function addLanguage(code: string) {
    if (!code || teachingLanguages.includes(code)) return;
    setNewLang('');
    startTransition(async () => {
      try {
        await updateTutor.mutateAsync({ teachingLanguages: [...teachingLanguages, code] });
        await queryClient.invalidateQueries({ queryKey: profileKeys.tutorMe() });
      } catch {
        toast.error(tErr('unknown'));
      }
    });
  }

  function removeLanguage(code: string) {
    startTransition(async () => {
      try {
        await updateTutor.mutateAsync({ teachingLanguages: teachingLanguages.filter((l) => l !== code) });
        await queryClient.invalidateQueries({ queryKey: profileKeys.tutorMe() });
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

  if (isLoading) {
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

      {/* Teaching languages */}
      <Field label={t('teaching.languages')} htmlFor="teaching-lang-picker">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {teachingLanguages.map((code) => (
              <span key={code} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
                {code}
                <button
                  type="button"
                  aria-label={`Remove ${code}`}
                  disabled={isPending}
                  onClick={() => removeLanguage(code)}
                  className="text-(--ssz-text-muted) hover:text-destructive disabled:opacity-50"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <LanguageCombobox
            id="teaching-lang-picker"
            value={newLang}
            onChange={addLanguage}
            placeholder="Add a language…"
            exclude={teachingLanguages}
            disabled={isPending}
          />
        </div>
      </Field>

      {/* CEFR levels — display only for now; backend field pending */}
      <Field label={t('teaching.cefr')} htmlFor="cefr-display">
        <div className="flex flex-wrap gap-1">
          {CEFR_LEVELS.map((level) => (
            <Badge key={level} variant="muted">{level}</Badge>
          ))}
        </div>
        {/* TODO(backend): store selected CEFR levels in TutorProfile.teachingCefrLevels */}
        {/* TODO(backend): interactive level picker when TutorProfile.teachingCefrLevels is ready */}
        <p className="mt-1 text-xs text-(--ssz-text-muted)">Level selection coming soon.</p>
      </Field>

      {/* Hourly rate — tutor only */}
      {showRate && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
