'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Undo2 } from 'lucide-react';

import type { ReviewVerdictRecord } from '../../types';

/**
 * What happened last time, above the work that answers it.
 *
 * A second try is a reply, and reading a reply without the message it answers is how a
 * teacher repeats a correction the learner has already acted on. Amber rather than neutral
 * because it is the one block on the screen that is *not* this submission — the boundary
 * has to be visible at a glance, or the old comment gets read as part of the new work.
 */
export function PreviousAttempt({
  verdict,
  labelOf,
}: {
  verdict: ReviewVerdictRecord;
  /** Names an item for the per-item rulings; absent, the ruling is shown without a heading. */
  labelOf?: (itemId: string) => string;
}) {
  const t = useTranslations('Review.submission.previous');
  const format = useFormatter();
  const rulings = (verdict.decisions ?? []).filter((d) => (d.comment ?? '').trim() !== '');
  const written = verdict.comment !== null && verdict.comment.trim() !== '';

  return (
    <section
      className="rounded-[11px] border-[1.5px] px-3.5 py-3"
      style={{
        borderColor: 'oklch(0.86 0.05 82)',
        background: 'color-mix(in oklch, var(--color-warning-500) 7%, transparent)',
      }}
      aria-label={t('title')}
    >
      <div className="flex items-center gap-2">
        <Undo2 aria-hidden className="h-4 w-4 text-warning-700 dark:text-warning-300" />
        <p className="text-[13px] font-bold text-warning-700 dark:text-warning-300">{t('title')}</p>
        <p className="ml-auto text-[11.5px] text-muted-foreground">
          {t('by', {
            name: verdict.reviewerName ?? t('someone'),
            date: format.dateTime(new Date(verdict.at), { dateStyle: 'medium' }),
          })}
        </p>
      </div>

      {!written && rulings.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {rulings.map((ruling) => {
            const label = labelOf?.(ruling.itemId) ?? '';
            return (
              <li key={ruling.itemId}>
                {label === '' ? null : <p className="text-[12.5px] font-semibold">{label}</p>}
                <p
                  className="whitespace-pre-wrap text-[14px] leading-relaxed"
                  style={{ fontFamily: 'var(--ssz-font-reading)' }}
                >
                  {ruling.comment}
                </p>
              </li>
            );
          })}
        </ul>
      ) : !written ? (
        <p className="mt-2 text-[13px] italic text-muted-foreground">{t('noComment')}</p>
      ) : (
        <p
          className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed"
          style={{ fontFamily: 'var(--ssz-font-reading)' }}
        >
          {verdict.comment}
        </p>
      )}

      <p className="mt-2 text-[11.5px] text-muted-foreground">{t('explain')}</p>
    </section>
  );
}
