'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Filter } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useReviewQueue } from '../../api/use-review-queue';
import {
  DEFAULT_FILTERS,
  hasActiveFilters,
  parseQueueFilters,
  queueFiltersToQuery,
} from '../../lib/queue-filters';
import type { ReviewQueueFilters } from '../../types';
import { AgeMark, useAgeWords } from '../age-mark';
import { AgeSpread } from '../age-spread';

import { QueueFiltersBar } from './queue-filters-bar';

export interface ReviewInboxProps {
  /** The school as the address bar spells it — the BFF takes a slug or an id. */
  school: string;
}

/**
 * The teacher's inbox: everything waiting, and the one screen it is waited on.
 *
 * A split without a navigation between its halves. Marking is a pass through a list, and a
 * screen that returned to the list after every verdict would make the teacher find their
 * place again twenty times an hour — so the queue stays on the left and the submission
 * opens on the right (the right-hand panel arrives in 45.5; until then the column says
 * what it is for).
 *
 * Below 1024px the columns cannot both be real, so the list takes the width and a
 * submission becomes its own page. Marking is desk work; on a phone this screen answers
 * "how much has piled up", which is a different and smaller question.
 */
export function ReviewInbox({ school }: ReviewInboxProps) {
  const t = useTranslations('Review');
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = parseQueueFilters(searchParams);
  const selected = searchParams.get('submission');
  const { data, isPending, isError, refetch } = useReviewQueue(school, filters);

  // The view lives in the address bar (criterion 6), so every control writes there and
  // reads back — no second copy of the filters to fall out of step with the URL.
  const setFilters = useCallback(
    (next: Partial<ReviewQueueFilters>) => {
      const merged = { ...filters, ...next };
      // Changing the filters must not close a submission mid-read; it stays selected, and
      // the list around it changes.
      router.replace(queueFiltersToQuery(merged, selected), { scroll: false });
    },
    [filters, router, selected],
  );

  const clearFilters = useCallback(() => {
    router.replace(
      queueFiltersToQuery({ ...DEFAULT_FILTERS, groupBy: filters.groupBy }, selected),
      {
        scroll: false,
      },
    );
  }, [filters.groupBy, router, selected]);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-h-0 w-full flex-col border-border lg:w-[352px] lg:shrink-0 lg:border-r">
        <div className="flex flex-col gap-3 border-b border-border px-4 pb-3 pt-5">
          <div>
            <div className="label-overline">{t('inbox.eyebrow')}</div>
            <h1 className="text-xl font-bold tracking-tight">{t('inbox.title')}</h1>
            <Subtitle summary={data?.summary} />
          </div>
          <QueueFiltersBar
            filters={filters}
            facets={data?.facets ?? { groups: [], courses: [] }}
            onChange={setFilters}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-6">
          {isPending ? (
            <div className="flex flex-col gap-2 p-2" aria-busy>
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center" role="status">
              <p className="text-sm text-muted-foreground">{t('inbox.failed')}</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                {t('inbox.retry')}
              </Button>
            </div>
          ) : data.groups.length === 0 ? (
            <EmptyQueue filtered={hasActiveFilters(filters)} onClear={clearFilters} />
          ) : (
            <ul className="flex flex-col gap-4 pt-2">
              {data.groups.map((group) => (
                <QueueGroupStub key={group.key} group={group} selected={selected} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* The submission column. Empty until 45.5 gives it a panel to hold. */}
      <div className="hidden min-h-0 flex-1 lg:flex">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-base font-semibold">{t('inbox.selectPrompt')}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t('inbox.selectBody')}</p>
        </div>
      </div>
    </div>
  );
}

/** «27 работ · 9 дольше срока · самая старая 4 дня» — the queue in one line. */
function Subtitle({
  summary,
}: {
  summary:
    | { pending: number; overdue: number; overduePartial: boolean; oldestHours: number | null }
    | undefined;
}) {
  const t = useTranslations('Review');
  const { words } = useAgeWords();

  if (summary === undefined) return <p className="mt-1 h-5" />;

  const parts = [t('inbox.subtitle', { count: summary.pending })];
  if (summary.overdue > 0) {
    // "9+" while a cursor is still open: the count is over what has been loaded, and
    // quoting a page's number as the whole queue's would be a lie the screen can avoid.
    parts.push(
      summary.overduePartial
        ? t('inbox.subtitleOverduePartial', { count: summary.overdue })
        : t('inbox.subtitleOverdue', { count: summary.overdue }),
    );
  }
  if (summary.oldestHours !== null) {
    parts.push(t('inbox.subtitleOldest', { age: words(summary.oldestHours) }));
  }

  return <p className="mt-1 text-[13px] text-muted-foreground">{parts.join(' · ')}</p>;
}

/**
 * Nothing here — said two different ways on purpose.
 *
 * An empty queue is an achievement and reads like one; an empty *filter* is a dead end and
 * needs the way out beside it (criterion 10). Showing the first when the second is true
 * tells a teacher they are done when they are one click from a pile of work.
 */
function EmptyQueue({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  const t = useTranslations('Review');
  const Icon = filtered ? Filter : CheckCircle2;

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-[18px]"
        style={{
          background: filtered ? 'var(--ssz-bg-subtle)' : 'oklch(0.60 0.13 145 / 0.12)',
          color: filtered ? 'var(--ssz-text-muted)' : 'oklch(0.50 0.12 145)',
        }}
      >
        <Icon className="h-7 w-7" />
      </span>
      <p className="text-[17px] font-bold tracking-tight">
        {filtered ? t('inbox.empty.filteredTitle') : t('inbox.empty.title')}
      </p>
      <p className="max-w-sm text-[13.5px] leading-relaxed text-muted-foreground">
        {filtered ? t('inbox.empty.filteredBody') : t('inbox.empty.body')}
      </p>
      {filtered ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          {t('inbox.filter.clear')}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * A group and its rows in their plainest honest form.
 *
 * Step 45.4 replaces this with the designed heading and row — sticky headers, urgency
 * rails, avatars, the batch action. What it will not change is what is on screen: a group
 * with its shape and a count, and rows carrying a name and an age in words. Building the
 * shell around a placeholder that showed nothing would have made the empty states the only
 * testable part of it.
 */
function QueueGroupStub({
  group,
  selected,
}: {
  group: import('../../types').ReviewQueueGroup;
  selected: string | null;
}) {
  const t = useTranslations('Review');

  return (
    <li>
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold">{group.title}</span>
        <span className="rounded-full bg-muted px-2 text-[11px] font-bold text-muted-foreground">
          {group.count}
        </span>
      </div>
      {group.slaHours === null ? null : (
        <div className="px-2.5 pb-2 pl-[34px]">
          <AgeSpread hours={group.ages} slaHours={group.slaHours} height={7} />
        </div>
      )}
      <ul className="flex flex-col">
        {group.items.map((item) => (
          <li
            key={item.id}
            data-selected={item.id === selected}
            className="flex items-center gap-2.5 rounded-[11px] px-2.5 py-2 data-[selected=true]:bg-accent/10"
          >
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
              {item.student.name ?? item.student.id}
            </span>
            {item.attemptNo > 1 ? (
              <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                {t('inbox.row.attempt', { n: item.attemptNo })}
              </span>
            ) : null}
            {group.slaHours === null ? null : (
              <AgeMark hours={item.ageHours} slaHours={group.slaHours} showOverdue={false} />
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}
