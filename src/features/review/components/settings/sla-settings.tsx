'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { AgeSpread } from '../age-spread';
import { Panel } from '../primitives';
import { reviewKeys } from '../../api/keys';
import {
  useSchoolReviewSettings,
  useSaveSchoolReviewSettings,
} from '../../api/use-review-settings';
import type { SchoolReviewSettings } from '../../types/oversight';

/** The ages the preview is drawn from — a plausible week, so the scale has something to say. */
const PREVIEW_AGES = [2, 6, 12, 20, 30, 44, 50, 60, 72, 90, 110];

/** The bounds organization-service enforces (plan 44 §44.12), mirrored for an early answer. */
const MIN_HOURS = 1;
const MAX_HOURS = 720;

export interface SlaSettingsProps {
  school: string;
  /** Whether the caller may change it. A MANAGER reads the promise but does not set it. */
  canEdit: boolean;
}

/**
 * The response time a school promises, with the consequences of the number visible while
 * it is being typed.
 *
 * One field here decides the colour of every queue in the school, which submissions appear
 * as stuck, and the date a learner is shown while they wait (criterion 34). That is far too
 * much to leave to a number in a box, so the age scale is redrawn under the field as it
 * changes: an administrator sees what 24 hours does to the same week of work that 48 hours
 * left looking calm.
 *
 * The bounds are checked here as well as upstream — not instead of. A form that only learns
 * a number was refused after a round trip is a form that argues with its user; a form that
 * decided on its own would drift from the service the day the service changed its mind.
 */
export function SlaSettings({ school, canEdit }: SlaSettingsProps) {
  const t = useTranslations('Review.settings');
  const queryClient = useQueryClient();

  const { data, isPending, isError } = useSchoolReviewSettings(school);
  const save = useSaveSchoolReviewSettings(school);

  // The edit, if there is one — not a copy of the server's answer kept in step with it.
  // Nothing is held here until somebody types, so the fields read from the query until
  // then and a refetch cannot overwrite what is being typed. Cancelling and saving both
  // drop the draft, which puts the server's answer back on screen.
  const [draft, setDraft] = useState<SchoolReviewSettings | null>(null);

  if (isError) {
    return (
      <Panel title={t('title')}>
        <p className="text-[12.5px] text-muted-foreground">{t('failed')}</p>
      </Panel>
    );
  }

  if (data === undefined || isPending) {
    return <Skeleton className="h-[280px] rounded-[14px]" />;
  }

  const form = draft ?? data;

  const respondError =
    form.respondWithinHours < MIN_HOURS || form.respondWithinHours > MAX_HOURS
      ? t('respond.bounds', { min: MIN_HOURS, max: MAX_HOURS })
      : null;

  // The escalation is a second warning about the same promise, so it cannot come first.
  const escalateError =
    form.escalateAfterHours < form.respondWithinHours ? t('escalate.beforeRespond') : null;

  const invalid = respondError !== null || escalateError !== null;

  const submit = () => {
    if (invalid) return;
    save.mutate(form, {
      onSuccess: () => {
        setDraft(null);
        toast.success(t('saved'));
        // Everything that carries a colour was drawn against the old number (criterion 34).
        void queryClient.invalidateQueries({ queryKey: reviewKeys.queues() });
        void queryClient.invalidateQueries({ queryKey: reviewKeys.counts() });
        void queryClient.invalidateQueries({ queryKey: reviewKeys.oversights() });
        void queryClient.invalidateQueries({ queryKey: reviewKeys.submissions() });
      },
      onError: () => toast.error(t('saveFailed')),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title={t('title')} sub={t('sub')}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
          <Field
            label={t('respond.label')}
            hint={respondError ?? t('respond.hint')}
            invalid={respondError !== null}
          >
            <NumberField
              value={form.respondWithinHours}
              suffix={t('hours')}
              disabled={!canEdit}
              onChange={(respondWithinHours) => setDraft({ ...form, respondWithinHours })}
            />
          </Field>

          <Field
            label={t('escalate.label')}
            hint={escalateError ?? t('escalate.hint')}
            invalid={escalateError !== null}
          >
            <NumberField
              value={form.escalateAfterHours}
              suffix={t('hours')}
              disabled={!canEdit}
              onChange={(escalateAfterHours) => setDraft({ ...form, escalateAfterHours })}
            />
          </Field>

          <Field label={t('escalateTo.label')} hint={t('escalateTo.hint')}>
            <select
              aria-label={t('escalateTo.label')}
              value={form.escalateTo}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft({
                  ...form,
                  escalateTo: event.target.value as SchoolReviewSettings['escalateTo'],
                })
              }
              className="w-full max-w-[240px] rounded-[9px] border-[1.5px] border-border bg-(--ssz-bg-base) px-2.5 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="school_admins">{t('escalateTo.school_admins')}</option>
              <option value="owner">{t('escalateTo.owner')}</option>
              <option value="primary_teacher">{t('escalateTo.primary_teacher')}</option>
            </select>
          </Field>
        </div>

        <div className="mt-[18px]">
          <AgeSpread
            hours={PREVIEW_AGES}
            slaHours={respondError === null ? form.respondWithinHours : data.respondWithinHours}
            height={12}
            className="w-full"
          />
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">
            {t('preview', { n: form.respondWithinHours })}
          </p>
        </div>
      </Panel>

      {canEdit ? (
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => setDraft(null)} disabled={save.isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={invalid || save.isPending}>
            {t('save')}
          </Button>
        </div>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">{t('readOnly')}</p>
      )}
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
  suffix,
  disabled,
  onChange,
}: {
  value: number;
  suffix: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <span className="flex items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        min={MIN_HOURS}
        max={MAX_HOURS}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-24 rounded-[9px] border-[1.5px] border-border bg-(--ssz-bg-base) px-[11px] py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground"
      />
      <span className="text-[12.5px] text-(--ssz-text-secondary)">{suffix}</span>
    </span>
  );
}
