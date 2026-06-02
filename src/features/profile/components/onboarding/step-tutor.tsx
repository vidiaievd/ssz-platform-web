'use client';

import { useState, useTransition, useId } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { saveTutorStepAction } from '../../actions/save-prefs-step';
import { useOnboardingStore } from '../../stores/onboarding-store';
import { PROFICIENCY_LEVELS } from '../../schemas/onboarding';
import type { ProficiencyLevel } from '../../schemas/onboarding';
import { LanguageCombobox } from './language-combobox';

const CURRENCIES = ['EUR', 'USD', 'NOK', 'UAH'] as const;
type Currency = (typeof CURRENCIES)[number];

type TeachingLanguageRow = { code: string; proficiency: ProficiencyLevel | '' };

type StepTutorProps = {
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onDone: () => void;
};

export function StepTutor({ headingRef, onBack, onDone }: StepTutorProps) {
  const t = useTranslations('Onboarding');
  const [isPending, startTransition] = useTransition();
  const liveRegionId = useId();

  const { tutorDraft, setTutorDraft } = useOnboardingStore();

  const [rows, setRows] = useState<TeachingLanguageRow[]>(
    tutorDraft.teachingLanguages.length > 0
      ? tutorDraft.teachingLanguages.map((l) => ({ code: l.code, proficiency: l.proficiency as ProficiencyLevel }))
      : [],
  );
  const [hourlyRate, setHourlyRate] = useState(
    tutorDraft.hourlyRate !== null ? String(tutorDraft.hourlyRate) : '',
  );
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [experience, setExperience] = useState(
    tutorDraft.specializations.join(', '),
  );
  const [liveMessage, setLiveMessage] = useState('');

  const isLoading = isPending;
  const experienceLength = experience.length;

  function excludeForRow(idx: number) {
    return rows.filter((_, i) => i !== idx).map((r) => r.code).filter(Boolean);
  }

  function updateCode(idx: number, code: string) {
    const updated = rows.map((r, i) => (i === idx ? { ...r, code } : r));
    setRows(updated);
    syncDraft(updated);
  }

  function updateProficiency(idx: number, proficiency: ProficiencyLevel) {
    const updated = rows.map((r, i) => (i === idx ? { ...r, proficiency } : r));
    setRows(updated);
    syncDraft(updated);
  }

  function addRow() {
    if (rows.length >= 10) return;
    const updated = [...rows, { code: '', proficiency: '' as const }];
    setRows(updated);
    syncDraft(updated);
    setLiveMessage(t('tutor.languages.added'));
  }

  function removeRow(idx: number) {
    const updated = rows.filter((_, i) => i !== idx);
    setRows(updated);
    syncDraft(updated);
    setLiveMessage(t('tutor.languages.removed'));
  }

  function syncDraft(updated: TeachingLanguageRow[]) {
    const filled = updated
      .filter((r) => r.code && r.proficiency)
      .map((r) => ({ code: r.code, proficiency: r.proficiency as ProficiencyLevel }));
    setTutorDraft({ teachingLanguages: filled });
  }

  function handleFinish() {
    const teachingLanguages = rows
      .filter((r) => r.code && r.proficiency)
      .map((r) => ({ code: r.code, proficiency: r.proficiency as ProficiencyLevel }));

    const rate = hourlyRate ? parseFloat(hourlyRate) : null;

    startTransition(async () => {
      const result = await saveTutorStepAction({
        teachingLanguages,
        hourlyRate: rate && !isNaN(rate) ? rate : null,
        specializations: experience
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 10),
      });
      if (!result.ok) {
        toast.error(t('error.saveFailed'));
        return;
      }
      onDone();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold text-(--ssz-text-primary) focus:outline-none"
        >
          {t('step.tutor.title')}
        </h1>
        <p className="mt-2 text-(--ssz-text-secondary) leading-relaxed">{t('step.tutor.subtitle')}</p>
      </div>

      {/* Teaching languages */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-(--ssz-text-primary)">{t('tutor.languages.heading')}</p>

        {rows.length === 0 ? (
          <p className="text-sm text-(--ssz-text-muted)">{t('tutor.languages.emptyHint')}</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <LanguageCombobox
                    value={row.code}
                    onChange={(code) => updateCode(idx, code)}
                    placeholder={t('prefs.native.placeholder')}
                    exclude={excludeForRow(idx)}
                    disabled={isLoading}
                  />
                </div>
                <Select
                  value={row.proficiency}
                  onValueChange={(v) => updateProficiency(idx, v as ProficiencyLevel)}
                  disabled={isLoading || !row.code}
                >
                  <SelectTrigger className="w-32.5" aria-label={t('tutor.proficiency.label')}>
                    <SelectValue placeholder={t('tutor.proficiency.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFICIENCY_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(idx)}
                  disabled={isLoading}
                  aria-label={t('tutor.languages.remove')}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {rows.length < 10 && (
          <Button
            type="button"
            variant="outline"
            onClick={addRow}
            disabled={isLoading}
            className="w-full border-dashed"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('tutor.languages.add')}
          </Button>
        )}
      </div>

      {/* Hourly rate + currency */}
      <Field label={t('tutor.hourlyRate.label')} htmlFor="hourly-rate">
        <div className="flex gap-2">
          <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)} disabled={isLoading}>
            <SelectTrigger className="w-24 shrink-0" aria-label={t('tutor.hourlyRate.currency.label')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id="hourly-rate"
            type="number"
            min={0}
            step={1}
            placeholder={t('tutor.hourlyRate.placeholder')}
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            disabled={isLoading}
            className="flex-1"
            aria-label={t('tutor.hourlyRate.label')}
          />
        </div>
      </Field>

      {/* Experience */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="experience" className="text-sm font-medium text-(--ssz-text-primary)">
            {t('tutor.experience.label')}
          </label>
          <span
            aria-live="polite"
            className={
              experienceLength >= 400
                ? 'text-xs text-(--ssz-color-error-600)'
                : experienceLength >= 360
                  ? 'text-xs text-(--ssz-color-warning-600)'
                  : 'text-xs text-(--ssz-text-muted)'
            }
          >
            {t('tutor.experience.counter', { count: experienceLength })}
          </span>
        </div>
        <Textarea
          id="experience"
          rows={4}
          placeholder={t('tutor.experience.placeholder')}
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          disabled={isLoading}
          maxLength={400}
        />
        <p className="text-xs text-(--ssz-text-muted)">{t('tutor.experience.hint')}</p>
      </div>

      {/* Reassurance */}
      <p className="text-sm text-(--ssz-text-muted) leading-relaxed">
        {t('tutor.reassurance')}
      </p>

      {/* Screen-reader live region */}
      <div id={liveRegionId} aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      {/* Footer — no skip button; Continue works as skip since all fields optional */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isLoading}>
          {t('back')}
        </Button>

        <Button
          type="button"
          onClick={handleFinish}
          disabled={isLoading}
          loading={isPending}
        >
          {t('finishCta')}
        </Button>
      </div>
    </div>
  );
}
