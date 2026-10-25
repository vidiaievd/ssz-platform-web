'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { Panel } from '../primitives';
import { useSaveSchoolReviewEffort, useSchoolReviewEffort } from '../../api/use-review-settings';
import {
  effortDraft,
  effortInput,
  effortRows,
  isEffortValue,
  MAX_EFFORT_MINUTES,
  MIN_EFFORT_MINUTES,
  type EffortDraft,
  type EffortRow,
} from '../../lib/review-effort-form';
import { REVIEWABLE_EXERCISE_TYPES, type ReviewableExerciseType } from '../../types';

export interface ReviewEffortSettingsProps {
  school: string;
  canEdit: boolean;
}

/**
 * How long one submission of each type takes to check — the school's starting figures for
 * the marking forecast, with what its own verdicts have measured beside them (plan 81, Q5).
 *
 * One figure per type for every teacher of the school. A measured median takes over once
 * enough verdicts back it, so the column beside each field says which of the two the
 * forecast is using now: a school should not be tuning a number nobody reads any more.
 *
 * An empty field is the factory figure. Clearing a figure the school set gives it back,
 * and what the factory says appears after saving — the service fills it in, not the form.
 */
export function ReviewEffortSettings({ school, canEdit }: ReviewEffortSettingsProps) {
  const t = useTranslations('Review.settings.effort');
  const tType = useTranslations('Review.type');
  const format = useFormatter();

  const { data, isError } = useSchoolReviewEffort(school);
  const save = useSaveSchoolReviewEffort(school);
  // As in the response-time form: nothing is held until somebody types.
  const [draft, setDraft] = useState<EffortDraft | null>(null);

  if (isError) {
    return (
      <Panel title={t('title')}>
        <p className="text-[12.5px] text-muted-foreground">{t('failed')}</p>
      </Panel>
    );
  }
  if (!data) return <Skeleton className="h-[320px] rounded-[14px]" />;

  const form = draft ?? effortDraft(data);
  const rows = effortRows(data);
  const invalid =
    !isEffortValue(form.other) || Object.values(form.templates).some((v) => !isEffortValue(v));

  // Explicit branches, not a key built from the code (next-intl types, see review-block-errors).
  const label = (code: string): string => {
    if ((REVIEWABLE_EXERCISE_TYPES as readonly string[]).includes(code)) {
      return tType(code as ReviewableExerciseType);
    }
    if (code === 'information_transfer') return t('informationTransfer');
    return code;
  };

  const measuredText = (row: EffortRow): string => {
    const measured = row.measured;
    if (data.measured === null) return t('measured.unavailable');
    if (measured === null || measured.sampleSize === 0) return t('measured.none');
    if (measured.medianMinutes === null) {
      return t('measured.tooFew', { n: measured.sampleSize, min: data.measured.minSample });
    }
    return t('measured.median', {
      minutes: format.number(measured.medianMinutes),
      n: measured.sampleSize,
    });
  };

  const setTemplate = (code: string, value: string) =>
    setDraft({ ...form, templates: { ...form.templates, [code]: value } });

  const submit = () => {
    if (invalid) return;
    save.mutate(effortInput(form), {
      onSuccess: () => {
        setDraft(null);
        toast.success(t('saved'));
      },
      onError: () => toast.error(t('saveFailed')),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title={t('title')}
        sub={t('sub', {
          days: data.measured?.historyDays ?? 90,
          min: data.measured?.minSample ?? 20,
        })}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11.5px] font-semibold text-muted-foreground">
              <th scope="col" className="pb-2 pr-3 font-semibold">
                {t('type')}
              </th>
              <th scope="col" className="pb-2 pr-3 font-semibold">
                {t('minutes')}
              </th>
              <th scope="col" className="hidden pb-2 font-semibold sm:table-cell">
                {t('measured.title')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const value = form.templates[row.templateCode] ?? '';
              const applies = row.measured?.medianMinutes != null;
              return (
                <tr key={row.templateCode} className="align-top">
                  <th scope="row" className="py-2 pr-3 text-left font-medium">
                    {label(row.templateCode)}
                    <span className="block text-[11.5px] font-normal text-muted-foreground">
                      {value.trim() !== ''
                        ? t('source.school')
                        : row.source === 'other'
                          ? t('source.other')
                          : t('source.default')}
                    </span>
                  </th>
                  <td className="py-2 pr-3">
                    <MinutesField
                      id={`effort-${row.templateCode}`}
                      label={label(row.templateCode)}
                      value={value}
                      placeholder={row.placeholder}
                      disabled={!canEdit}
                      suffix={t('min')}
                      onChange={(next) => setTemplate(row.templateCode, next)}
                    />
                    {/* The measured column is hidden on a phone; its sentence moves here. */}
                    <span className="mt-1 block text-[11.5px] text-muted-foreground sm:hidden">
                      {measuredText(row)}
                    </span>
                  </td>
                  <td
                    className={`hidden py-2 text-[12.5px] sm:table-cell ${
                      applies ? 'font-semibold text-(--ssz-text-primary)' : 'text-muted-foreground'
                    }`}
                  >
                    {measuredText(row)}
                    {applies && (
                      <span className="block text-[11.5px] font-normal text-muted-foreground">
                        {t('measured.inUse')}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            <tr className="align-top">
              <th scope="row" className="py-2 pr-3 text-left font-medium">
                {t('other')}
                <span className="block text-[11.5px] font-normal text-muted-foreground">
                  {t('otherHint')}
                </span>
              </th>
              <td className="py-2 pr-3" colSpan={2}>
                <MinutesField
                  id="effort-other"
                  label={t('other')}
                  value={form.other}
                  placeholder={data.other.source === 'default' ? data.other.minutes : null}
                  disabled={!canEdit}
                  suffix={t('min')}
                  onChange={(other) => setDraft({ ...form, other })}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <p
          className={`mt-3 text-[11.5px] ${
            invalid ? 'text-error-600 dark:text-error-400' : 'text-muted-foreground'
          }`}
        >
          {invalid
            ? t('bounds', { min: MIN_EFFORT_MINUTES, max: MAX_EFFORT_MINUTES })
            : t('emptyHint')}
        </p>
      </Panel>

      {canEdit ? (
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={() => setDraft(null)} disabled={save.isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={invalid || draft === null || save.isPending}>
            {t('save')}
          </Button>
        </div>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">{t('readOnly')}</p>
      )}
    </div>
  );
}

function MinutesField({
  id,
  label,
  value,
  placeholder,
  disabled,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: number | null;
  disabled: boolean;
  suffix: string;
  onChange: (value: string) => void;
}) {
  return (
    <span className="flex items-center gap-2">
      <input
        id={id}
        aria-label={label}
        type="number"
        inputMode="numeric"
        min={MIN_EFFORT_MINUTES}
        max={MAX_EFFORT_MINUTES}
        value={value}
        placeholder={placeholder === null ? '—' : String(placeholder)}
        disabled={disabled}
        aria-invalid={!isEffortValue(value)}
        onChange={(event) => onChange(event.target.value)}
        className="w-20 rounded-[9px] border-[1.5px] border-border bg-(--ssz-bg-base) px-[11px] py-1.5 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-error-500 disabled:text-muted-foreground"
      />
      <span className="text-[12.5px] text-(--ssz-text-secondary)">{suffix}</span>
    </span>
  );
}
