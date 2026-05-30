'use client';

import { useState, useTransition, useId } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { generateSlug } from '@/lib/utils/slug';
import { saveTutorStepAction, skipTutorStepAction } from '../../actions/save-prefs-step';
import { useOnboardingStore } from '../../stores/onboarding-store';
import { PROFICIENCY_LEVELS } from '../../schemas/onboarding';
import type { ProficiencyLevel } from '../../schemas/onboarding';
import { LanguageCombobox } from './language-combobox';

type TeachingLanguageRow = { code: string; proficiency: ProficiencyLevel | '' };

type StepTutorProps = {
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onDone: () => void;
};

export function StepTutor({ headingRef, onBack, onDone }: StepTutorProps) {
  const t = useTranslations('Onboarding');
  const [isPending, startTransition] = useTransition();
  const [isSkipping, startSkipTransition] = useTransition();
  const liveRegionId = useId();

  const { tutorDraft, setTutorDraft, profileDraft } = useOnboardingStore();

  const [rows, setRows] = useState<TeachingLanguageRow[]>(
    tutorDraft.teachingLanguages.length > 0
      ? tutorDraft.teachingLanguages.map((l) => ({ code: l.code, proficiency: l.proficiency as ProficiencyLevel }))
      : [{ code: '', proficiency: '' }],
  );
  const [hourlyRate, setHourlyRate] = useState(
    tutorDraft.hourlyRate !== null ? String(tutorDraft.hourlyRate) : '',
  );
  const [specializations, setSpecializations] = useState(
    tutorDraft.specializations.join(', '),
  );
  const [liveMessage, setLiveMessage] = useState('');
  const [rowsError, setRowsError] = useState('');

  const isLoading = isPending || isSkipping;

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
    if (rows.length <= 1) return;
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

  function validate(): boolean {
    const incomplete = rows.some((r) => !r.code || !r.proficiency);
    if (incomplete || rows.filter((r) => r.code).length === 0) {
      const msg = t('tutor.languages.error.required');
      setRowsError(msg);
      toast.error(msg);
      return false;
    }
    setRowsError('');
    return true;
  }

  function handleFinish() {
    if (!validate()) return;

    const teachingLanguages = rows
      .filter((r) => r.code && r.proficiency)
      .map((r) => ({ code: r.code, proficiency: r.proficiency as ProficiencyLevel }));

    const rate = hourlyRate ? parseFloat(hourlyRate) : null;
    const specs = specializations
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    startTransition(async () => {
      const result = await saveTutorStepAction({
        teachingLanguages,
        hourlyRate: rate && !isNaN(rate) ? rate : null,
        specializations: specs,
      });
      if (!result.ok) {
        toast.error(t('error.saveFailed'));
        return;
      }
      onDone();
    });
  }

  function handleSkip() {
    startSkipTransition(async () => {
      const result = await skipTutorStepAction();
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
        {rowsError && (
          <p role="alert" className="text-sm text-(--ssz-color-error-600)">{rowsError}</p>
        )}
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
                disabled={isLoading || rows.length <= 1}
                aria-label={t('tutor.languages.remove')}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
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

      {/* Hourly rate */}
      <Field label={t('tutor.hourlyRate.label')} htmlFor="hourly-rate">
        <Input
          id="hourly-rate"
          type="number"
          min={0}
          step={0.01}
          placeholder={t('tutor.hourlyRate.placeholder')}
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
          disabled={isLoading}
        />
      </Field>

      {/* Specializations */}
      <Field
        label={t('tutor.specializations.label')}
        htmlFor="specializations"
        hint={t('tutor.specializations.hint')}
      >
        <Input
          id="specializations"
          placeholder={t('tutor.specializations.placeholder')}
          value={specializations}
          onChange={(e) => setSpecializations(e.target.value)}
          disabled={isLoading}
        />
      </Field>

      {/* Screen-reader live region */}
      <div id={liveRegionId} aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm" disabled={isLoading}>
                {t('skip.label')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('skip.confirm.title')}</AlertDialogTitle>
                <AlertDialogDescription>{t('skip.warning')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('back')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleSkip}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('skip.label')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button type="button" variant="ghost" onClick={onBack} disabled={isLoading}>
            {t('back')}
          </Button>
        </div>

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
