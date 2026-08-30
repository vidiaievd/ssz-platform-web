'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { useDecisions } from '../../api/use-decisions';
import { useAgeWords } from '../age-mark';
import { Panel } from '../primitives';
import type { OversightPeriod } from '../../types/oversight';

export interface DecisionLogProps {
  school: string;
  period: OversightPeriod;
}

/**
 * Who decided what, and when — the section an administrator opens when a learner writes in.
 *
 * The outcome carries the only colour on the row: amber for work sent back, green for work
 * passed. Neither is a judgement of the reviewer; they are the two things that can happen
 * to a submission, and a journal where they read alike would have to be searched instead of
 * scanned.
 *
 * The export is a plain link rather than a fetch: the file is streamed by the server, and a
 * link lets the browser save it as it arrives instead of holding a whole quarter of
 * verdicts in a blob first.
 */
export function DecisionLog({ school, period }: DecisionLogProps) {
  const t = useTranslations('Review.oversight.journal');
  const format = useFormatter();
  const locale = useLocale();
  const { words } = useAgeWords();

  const { data, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useDecisions(
    school,
    period,
  );

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const exportHref = `/api/review/decisions.csv?school=${encodeURIComponent(school)}&period=${period}&locale=${locale}`;

  return (
    <Panel
      title={t('title')}
      sub={t('sub', { n: period })}
      right={
        <Button variant="ghost" size="sm" asChild>
          <a href={exportHref} download>
            <Download aria-hidden className="size-3.5" />
            {t('export')}
          </a>
        </Button>
      }
      bodyClassName="px-2 pb-3 pt-1"
    >
      {isError ? (
        <p className="px-2 py-2 text-[12.5px] text-muted-foreground">{t('failed')}</p>
      ) : items.length === 0 ? (
        <p className="px-2 py-2 text-[12.5px] text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="flex flex-col">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`grid grid-cols-[130px_minmax(120px,1fr)_minmax(120px,1fr)_minmax(160px,1.4fr)_auto] items-center gap-3 px-2 py-[9px] text-[12.5px] ${
                index === 0 ? '' : 'border-t border-border'
              }`}
            >
              <span className="text-muted-foreground">
                {format.dateTime(new Date(item.reviewedAt), {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="truncate font-semibold">
                {item.reviewerName ?? t('unnamedReviewer')}
              </span>
              <span className="truncate text-(--ssz-text-secondary)">
                {item.studentName ?? t('unnamedStudent')}
              </span>
              <span className="truncate text-(--ssz-text-secondary)">
                {item.exerciseTitle ?? t('unnamedExercise')}
                {item.hours === null ? '' : ` · ${t('took', { age: words(item.hours) })}`}
              </span>
              <span
                className={`whitespace-nowrap font-semibold ${
                  item.verdict === 'returned'
                    ? 'text-warning-700 dark:text-warning-300'
                    : 'text-success-700 dark:text-success-300'
                }`}
              >
                {t(item.verdict === 'returned' ? 'verdict.returned' : 'verdict.approved')}
              </span>
            </div>
          ))}

          {hasNextPage ? (
            <div className="px-2 pt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {t('more')}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
