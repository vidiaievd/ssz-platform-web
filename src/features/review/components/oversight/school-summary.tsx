'use client';

import { useFormatter, useTranslations } from 'next-intl';

import { AgeSpread } from '../age-spread';
import { useAgeWords } from '../age-mark';
import { Panel, Stat } from '../primitives';
import { ageTone } from '../../lib/age-scale';
import type { ReviewOversightResponse } from '../../types/oversight';

export interface SchoolSummaryProps {
  data: ReviewOversightResponse;
}

/**
 * What the school is holding, in four figures and the shape behind them.
 *
 * The shape is the part that cannot be replaced by a number. "74 waiting" is the same
 * sentence whether they arrived this morning or have been sitting for a fortnight, and the
 * two situations call for entirely different weeks; the histogram under the figures is
 * where that difference is visible (criterion 26, 28).
 *
 * Under the heading, the date the figures begin at. Nothing before the migration carries a
 * school at all, so a median computed over "everything" would be a median over whatever
 * happened to survive — and presenting it as the school's whole history would be a lie the
 * screen could easily have avoided telling (criterion 27).
 */
export function SchoolSummary({ data }: SchoolSummaryProps) {
  const t = useTranslations('Review.oversight');
  const tAge = useTranslations('Review.age');
  const format = useFormatter();
  const { words } = useAgeWords();

  const sla = data.schoolSlaHours;
  const { pending, overdue, oldestHours, medianHours } = data.summary;

  return (
    <Panel
      title={t('summary.title')}
      sub={
        data.since === null
          ? t('summary.sinceUnknown')
          : t('summary.since', {
              date: format.dateTime(new Date(data.since), {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }),
            })
      }
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] items-start gap-[22px]">
        <Stat label={t('summary.pending')} value={pending} sub={t('summary.pendingSub')} />
        <Stat
          label={t('summary.overdue')}
          value={overdue === 0 ? '—' : overdue}
          // Coloured at one and a half times the promise: the figure stands for a set of
          // submissions with many ages, and the scale's midpoint is the honest stand-in.
          tone={overdue === 0 || sla === null ? undefined : ageTone(sla * 1.5, sla)}
          sub={sla === null ? t('summary.noPromise') : t('summary.promise', { n: sla })}
        />
        <Stat
          label={t('summary.oldest')}
          value={oldestHours === null ? '—' : words(oldestHours)}
          tone={oldestHours === null || sla === null ? undefined : ageTone(oldestHours, sla)}
          sub={t('summary.oldestSub')}
        />
        <Stat
          label={t('summary.median')}
          value={medianHours === null ? '—' : words(medianHours)}
          sub={
            medianHours === null
              ? t('summary.medianNone')
              : t('summary.medianSub', { n: data.periodDays })
          }
        />

        {data.ages.length === 0 || sla === null ? null : (
          <div className="col-span-full">
            <div className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
              {t('spread.title')}
            </div>
            <AgeSpread hours={data.ages} slaHours={sla} height={14} className="w-full" />
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
              <span>{tAge('scale.fresh')}</span>
              <span>{tAge('scale.atSla', { n: sla })}</span>
              <span>{tAge('scale.double')}</span>
            </div>
          </div>
        )}

        {data.truncated ? (
          <p className="col-span-full text-[11.5px] text-muted-foreground">
            {t('summary.truncated')}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
