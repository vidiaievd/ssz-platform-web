'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCan } from '@/features/entitlements';

import { Note, Panel } from '../primitives';
import {
  useSaveSchoolReviewPolicy,
  useSchoolReviewPolicy,
  useSchoolReviewSettings,
} from '../../api/use-review-settings';
import type { ReviewAiMode, SchoolReviewAiPolicy } from '../../types/oversight';

const MODES: ReviewAiMode[] = ['teacher_only', 'ai_then_teacher', 'ai_with_sampling'];

/** The bounds organization-service enforces (plan 80, step 1), mirrored for an early answer. */
const MIN_HOURS = 1;
const MAX_HOURS = 720;
const MIN_PERCENT = 0;
const MAX_PERCENT = 100;

export interface AiPolicySettingsProps {
  school: string;
  canEdit: boolean;
}

/**
 * Who answers this school's work first — the teacher alone, or a model the teacher then
 * confirms or samples (plan 80, R1).
 *
 * Drawn only where the plan carries `school.review_ai_policy` (R7). The server refuses a mode
 * with a model without it anyway; hiding the choice is a courtesy, not the rule. A school that
 * lost the key with a mode with a model still saved is told what that means now, because a
 * silently ignored setting is worse than a missing one.
 *
 * The auto-accept term cannot come before the escalation (Q2-A): the school is warned about
 * stuck work before a model's verdict counts by itself. The form checks it against the
 * escalation the school has saved, the service checks it again on either save.
 */
export function AiPolicySettings({ school, canEdit }: AiPolicySettingsProps) {
  const t = useTranslations('Review.settings.policy');
  const can = useCan();
  const entitled = can('school.review_ai_policy');

  const policy = useSchoolReviewPolicy(school);
  const settings = useSchoolReviewSettings(school);
  const save = useSaveSchoolReviewPolicy(school);

  const [draft, setDraft] = useState<SchoolReviewAiPolicy | null>(null);

  if (policy.isError) {
    return entitled ? (
      <Panel title={t('title')}>
        <p className="text-[12.5px] text-muted-foreground">{t('failed')}</p>
      </Panel>
    ) : null;
  }

  if (policy.data === undefined) {
    return entitled ? <Skeleton className="h-[220px] rounded-[14px]" /> : null;
  }

  if (!entitled) {
    // Nothing to offer, and nothing to explain unless a mode with a model is still saved.
    if (policy.data.mode === 'teacher_only') return null;
    return (
      <Panel title={t('title')}>
        <Note tone="warn">{t('notEntitled')}</Note>
      </Panel>
    );
  }

  // Spelled out, not `t(`mode.${mode}.label`)`: a key built from a template sends tsc into
  // next-intl's whole message map.
  const modeText: Record<ReviewAiMode, { label: string; hint: string }> = {
    teacher_only: { label: t('mode.teacher_only.label'), hint: t('mode.teacher_only.hint') },
    ai_then_teacher: {
      label: t('mode.ai_then_teacher.label'),
      hint: t('mode.ai_then_teacher.hint'),
    },
    ai_with_sampling: {
      label: t('mode.ai_with_sampling.label'),
      hint: t('mode.ai_with_sampling.hint'),
    },
  };

  const form = draft ?? policy.data;
  const usesAi = form.mode !== 'teacher_only';
  const escalateAfterHours = settings.data?.escalateAfterHours ?? null;

  const hoursError = !usesAi
    ? null
    : !Number.isInteger(form.autoAcceptAfterHours) ||
        form.autoAcceptAfterHours < MIN_HOURS ||
        form.autoAcceptAfterHours > MAX_HOURS
      ? t('autoAccept.bounds', { min: MIN_HOURS, max: MAX_HOURS })
      : escalateAfterHours !== null && form.autoAcceptAfterHours < escalateAfterHours
        ? t('autoAccept.beforeEscalation', { n: escalateAfterHours })
        : null;

  const percentError =
    form.mode !== 'ai_with_sampling'
      ? null
      : !Number.isInteger(form.samplePercent) ||
          form.samplePercent < MIN_PERCENT ||
          form.samplePercent > MAX_PERCENT
        ? t('sample.bounds', { min: MIN_PERCENT, max: MAX_PERCENT })
        : null;

  const invalid = hoursError !== null || percentError !== null;

  const submit = () => {
    if (invalid) return;
    save.mutate(form, {
      onSuccess: () => {
        setDraft(null);
        toast.success(t('saved'));
      },
      onError: (error) =>
        toast.error(
          error.reason === 'not_entitled'
            ? t('saveNotEntitled')
            : error.reason === 'validation'
              ? t('saveInvalid')
              : t('saveFailed'),
        ),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title={t('title')} sub={t('sub')}>
        <fieldset className="flex flex-col gap-2" disabled={!canEdit}>
          <legend className="sr-only">{t('title')}</legend>
          {MODES.map((mode) => (
            <label
              key={mode}
              className={`flex cursor-pointer gap-3 rounded-[11px] border-[1.5px] px-3.5 py-3 ${
                form.mode === mode ? 'border-primary bg-(--ssz-bg-base)' : 'border-border'
              }`}
            >
              <input
                type="radio"
                name="review-ai-mode"
                value={mode}
                checked={form.mode === mode}
                onChange={() => setDraft({ ...form, mode })}
                className="mt-[3px] accent-primary"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13.5px] font-semibold">{modeText[mode].label}</span>
                <span className="text-[12px] leading-snug text-muted-foreground">
                  {modeText[mode].hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {usesAi ? (
          <div className="mt-[18px] grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
            <Field
              label={t('autoAccept.label')}
              hint={
                hoursError ??
                t('autoAccept.hint', {
                  days: Math.round((form.autoAcceptAfterHours / 24) * 10) / 10,
                })
              }
              invalid={hoursError !== null}
            >
              <NumberField
                value={form.autoAcceptAfterHours}
                min={MIN_HOURS}
                max={MAX_HOURS}
                suffix={t('hours')}
                disabled={!canEdit}
                onChange={(autoAcceptAfterHours) => setDraft({ ...form, autoAcceptAfterHours })}
              />
            </Field>

            {form.mode === 'ai_with_sampling' ? (
              <Field
                label={t('sample.label')}
                hint={percentError ?? t('sample.hint')}
                invalid={percentError !== null}
              >
                <NumberField
                  value={form.samplePercent}
                  min={MIN_PERCENT}
                  max={MAX_PERCENT}
                  suffix="%"
                  disabled={!canEdit}
                  onChange={(samplePercent) => setDraft({ ...form, samplePercent })}
                />
              </Field>
            ) : null}
          </div>
        ) : null}

        {usesAi && !can('ai.review_direct') ? (
          <div className="mt-[18px]">
            <Note tone="warn">{t('noCredits')}</Note>
          </div>
        ) : null}
      </Panel>

      {canEdit ? (
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => setDraft(null)} disabled={save.isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={invalid || save.isPending || draft === null}>
            {t('save')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  hint,
  invalid = false,
  children,
}: {
  label: string;
  hint?: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-[5px]">
      <span className="text-[12.5px] font-semibold">{label}</span>
      {children}
      {hint === undefined ? null : (
        <span
          className={`text-[11.5px] leading-snug ${
            invalid ? 'text-error-600 dark:text-error-400' : 'text-muted-foreground'
          }`}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

function NumberField({
  value,
  min,
  max,
  suffix,
  disabled,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <span className="flex items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-24 rounded-[9px] border-[1.5px] border-border bg-(--ssz-bg-base) px-[11px] py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground"
      />
      <span className="text-[12.5px] text-(--ssz-text-secondary)">{suffix}</span>
    </span>
  );
}
