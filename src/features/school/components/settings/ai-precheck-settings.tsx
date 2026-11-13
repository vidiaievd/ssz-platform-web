'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCan } from '@/features/entitlements';
import { Note, Panel } from '@/features/review/components/primitives';

import { useAiPrecheck, useSaveAiPrecheck } from '../../api/use-ai-precheck';
import type { AiPrecheckSettings } from '../../types/ai-precheck';

/** The ranges organization-service accepts; a field outside them is flagged before the save. */
const MAX_PER_EXERCISE = 1000;
const MAX_MONTHLY_CREDITS = 1_000_000;

export interface AiPrecheckSettingsFormProps {
  school: string;
  canEdit: boolean;
}

/** An empty field is «no limit»; anything else must be a whole number in 1..max. */
function parseLimit(text: string, max: number): { value: number | null; valid: boolean } {
  const trimmed = text.trim();
  if (trimmed === '') return { value: null, valid: true };
  if (!/^\d+$/.test(trimmed)) return { value: null, valid: false };
  const value = Number(trimmed);
  return { value, valid: value >= 1 && value <= max };
}

/**
 * Whether the school's learners may rehearse with a model before handing in, and the
 * school's two limits on it (plan 84, step 9).
 *
 * Both limits are optional: the plan's pool of `ai.practice` credits and its own per-learner
 * ceiling hold whatever is entered here, and the lower of the school's and the plan's applies
 * at check time. Drawn only where the plan carries `ai.practice`; the settings nav hides the
 * page without it, and organization-service refuses turning the checks on without it.
 */
export function AiPrecheckSettingsForm({ school, canEdit }: AiPrecheckSettingsFormProps) {
  const t = useTranslations('Settings.precheck');
  const can = useCan();

  const settings = useAiPrecheck(school);
  const save = useSaveAiPrecheck(school);

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [perExercise, setPerExercise] = useState<string | null>(null);
  const [monthly, setMonthly] = useState<string | null>(null);

  if (!can('ai.practice')) return null;

  if (settings.isError) {
    return (
      <Panel title={t('title')}>
        <p className="text-[12.5px] text-muted-foreground">{t('failed')}</p>
      </Panel>
    );
  }

  if (settings.data === undefined) return <Skeleton className="h-[320px] rounded-[14px]" />;

  const saved = settings.data;
  const form = {
    enabled: enabled ?? saved.enabled,
    perExercise: perExercise ?? saved.perExerciseLimit?.toString() ?? '',
    monthly: monthly ?? saved.perLearnerMonthlyCredits?.toString() ?? '',
  };
  const exercise = parseLimit(form.perExercise, MAX_PER_EXERCISE);
  const credits = parseLimit(form.monthly, MAX_MONTHLY_CREDITS);

  const next: AiPrecheckSettings = {
    enabled: form.enabled,
    perExerciseLimit: exercise.value,
    perLearnerMonthlyCredits: credits.value,
  };
  const dirty =
    next.enabled !== saved.enabled ||
    next.perExerciseLimit !== saved.perExerciseLimit ||
    next.perLearnerMonthlyCredits !== saved.perLearnerMonthlyCredits;

  const reset = () => {
    setEnabled(null);
    setPerExercise(null);
    setMonthly(null);
  };

  const submit = () => {
    save.mutate(next, {
      onSuccess: () => {
        reset();
        toast.success(t('saved'));
      },
      onError: (error) => {
        toast.error(
          error.reason === 'not_entitled'
            ? t('saveNotEntitled')
            : error.reason === 'invalid_settings'
              ? t('saveInvalid')
              : t('saveFailed'),
        );
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title={t('title')} sub={t('sub')}>
        <fieldset className="flex flex-col gap-4" disabled={!canEdit}>
          <legend className="sr-only">{t('title')}</legend>

          <label className="flex cursor-pointer gap-3 rounded-[11px] border-[1.5px] border-border px-3.5 py-3">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="mt-[3px] accent-primary"
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13.5px] font-semibold">{t('enabled.label')}</span>
              <span className="text-[12px] leading-snug text-muted-foreground">
                {t('enabled.hint')}
              </span>
            </span>
          </label>

          <LimitField
            id="precheck-per-exercise"
            label={t('perExercise.label')}
            hint={t('perExercise.hint')}
            error={exercise.valid ? null : t('perExercise.invalid', { max: MAX_PER_EXERCISE })}
            placeholder={t('noLimit')}
            value={form.perExercise}
            onChange={setPerExercise}
          />

          <LimitField
            id="precheck-monthly"
            label={t('monthly.label')}
            hint={t('monthly.hint')}
            error={credits.valid ? null : t('monthly.invalid', { max: MAX_MONTHLY_CREDITS })}
            placeholder={t('noLimit')}
            value={form.monthly}
            onChange={setMonthly}
          />
        </fieldset>

        {form.enabled &&
        next.perExerciseLimit === null &&
        next.perLearnerMonthlyCredits === null ? (
          <div className="mt-[18px]">
            <Note tone="warn">{t('unlimited')}</Note>
          </div>
        ) : null}

        {!canEdit ? (
          <p className="mt-3 text-[12.5px] text-muted-foreground">{t('readOnly')}</p>
        ) : null}
      </Panel>

      {canEdit ? (
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={reset} disabled={save.isPending || !dirty}>
            {t('cancel')}
          </Button>
          <Button
            onClick={submit}
            disabled={save.isPending || !dirty || !exercise.valid || !credits.valid}
          >
            {t('save')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function LimitField({
  id,
  label,
  hint,
  error,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  error: string | null;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={error !== null}
        aria-describedby={`${id}-hint`}
        className="w-[200px] rounded-[9px] border-[1.5px] border-border bg-(--ssz-bg-base) px-[11px] py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
      />
      <p id={`${id}-hint`} className="text-[12px] leading-snug text-muted-foreground">
        {error ?? hint}
      </p>
    </div>
  );
}
