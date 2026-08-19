'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import { useReviewViewStore } from '../../stores/review-view-store';
import type { ReviewGroupBy, ReviewQueueFilters, ReviewQueueGroup } from '../../types';
import { useAgeWords } from '../age-mark';

import { SubmissionPanel } from '../submission/submission-panel';

import { GroupHead } from './group-head';
import { QueueFiltersBar } from './queue-filters-bar';
import { QueueRow } from './queue-row';

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
  const pathname = usePathname();
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

  // Opening a submission is a `replace`, like every other view change here: twenty
  // verdicts in a marking pass would otherwise leave twenty history entries between the
  // teacher and wherever they came from.
  //
  // Except where the panel does not exist. Below 1024px the second column is not rendered
  // at all, so writing the id into the address bar there would answer a tap with nothing
  // visible happening; the submission is a page of its own instead, and a `push`, because
  // on that layout "back" is how you return to the queue.
  const selectSubmission = useCallback(
    (id: string) => {
      const wide =
        typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches;
      if (wide) {
        router.replace(queueFiltersToQuery(filters, id), { scroll: false });
        return;
      }
      router.push(`${pathname}/${id}`);
    },
    [filters, pathname, router],
  );

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
            <ul className="flex flex-col pt-0.5">
              {data.groups.map((group) => (
                <QueueGroup
                  key={group.key}
                  group={group}
                  groupBy={filters.groupBy}
                  selected={selected}
                  onSelect={selectSubmission}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Hidden below 1024px, where the submission becomes its own page instead: two real
          columns do not fit, and a panel squeezed beside the queue would be neither. */}
      <div className="hidden min-h-0 flex-1 lg:flex">
        {selected === null ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-base font-semibold">{t('inbox.selectPrompt')}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t('inbox.selectBody')}</p>
          </div>
        ) : (
          <SubmissionPanel
            key={selected}
            school={school}
            id={selected}
            position={positionOf(data, selected)}
          />
        )}
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
 * "3 of 27" — where the open submission sits in the queue as it is currently arranged.
 *
 * Counted over what is on screen rather than over the whole scope, because that is what
 * the number means to a teacher mid-pass: how far through *this* list they are. A position
 * against a total they have filtered away would be a different, useless number.
 */
function positionOf(
  data: { groups: ReviewQueueGroup[] } | undefined,
  selected: string,
): { index: number; total: number } | null {
  if (data === undefined) return null;

  const ids = data.groups.flatMap((group) => group.items.map((item) => item.id));
  const index = ids.indexOf(selected);
  return index === -1 ? null : { index: index + 1, total: ids.length };
}

/**
 * One group of the queue: its heading, and its rows while it is open.
 *
 * The order is the server's, top to bottom, and this component does not touch it. Two
 * teachers looking at the same queue must see the same first submission, and a client-side
 * sort would quietly disagree with the cursor the next page is fetched against.
 */
function QueueGroup({
  group,
  groupBy,
  selected,
  onSelect,
}: {
  group: ReviewQueueGroup;
  groupBy: ReviewGroupBy;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const collapsed = useReviewViewStore((state) => state.collapsed[group.key] === true);
  const toggleGroup = useReviewViewStore((state) => state.toggleGroup);

  // A submission a colleague holds is excluded from the batch: passing it in bulk is
  // exactly the collision the marker exists to prevent, and the verdict would 409 anyway.
  const cleanCount = group.items.filter((item) => item.autoClean && item.lock === null).length;

  return (
    <li>
      <GroupHead
        group={group}
        open={!collapsed}
        onToggle={() => toggleGroup(group.key)}
        cleanCount={groupBy === 'exercise' ? cleanCount : 0}
      />
      {collapsed ? null : (
        <ul className="flex flex-col gap-0.5 pb-1.5">
          {group.items.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              slaHours={group.slaHours}
              groupBy={groupBy}
              selected={item.id === selected}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
