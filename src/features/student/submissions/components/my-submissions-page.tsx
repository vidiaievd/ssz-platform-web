'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Chip } from '@/features/review/components/primitives';

import { useMySubmissions } from '../api/use-my-submissions';
import { groupByLesson } from '../lib/group-by-lesson';
import type { MySubmission, MySubmissionsFilter } from '../types';

import { MyRow } from './my-row';

const TABS: readonly MySubmissionsFilter[] = ['all', 'pending', 'returned', 'approved'];

/**
 * "Мои работы" — what the learner handed in, and what came back (plan 47.2, screen E).
 *
 * The screen exists because silence after handing something in is indistinguishable from
 * nobody having looked at it. So every row says which of the two it is, waiting work says
 * when an answer is due, and a returned one opens itself with the teacher's words already
 * on screen.
 *
 * The filter lives in the address bar, not in a state hook: a learner who followed a
 * notification here and then narrowed to "another go" should be able to send that link, or
 * come back to it, and find the same list.
 */
export function MySubmissionsPage() {
  const t = useTranslations('Review.student');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requested = searchParams.get('status');
  const status: MySubmissionsFilter = TABS.includes(requested as MySubmissionsFilter)
    ? (requested as MySubmissionsFilter)
    : 'all';

  const { data, isPending, isError, refetch } = useMySubmissions(status);

  // Which cards are open, over and above the returned ones that open themselves. Keyed by
  // submission so that switching tabs and coming back does not close what was being read.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  /**
   * The submission a notification pointed at (`?submission=<id>`).
   *
   * Read straight through into the open/closed decision rather than pushed into state on
   * arrival: an explicit toggle still wins over it, so a learner who closes the card they
   * were sent to has closed it and the deeplink does not keep arguing.
   */
  const focused = searchParams.get('submission');

  function pick(next: MySubmissionsFilter) {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    const query = params.toString();
    router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false });
  }

  const items = data?.items ?? [];
  const summary = data?.summary ?? null;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-6 pb-14 pt-6 sm:px-8">
      <header>
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-(--ssz-text-muted)">
          {t('eyebrow')}
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        {summary !== null && (
          <p className="mt-1 text-[13.5px] text-(--ssz-text-secondary)">
            {t('subtitle', { pending: summary.pending, returned: summary.returned })}
            {/*
              The counts describe the page that is loaded, not the whole history — said out
              loud rather than quietly rounded, the same way the teacher's queue says "9+".
            */}
            {summary.partial && (
              <span className="ml-1 text-(--ssz-text-muted)">{t('subtitlePartial')}</span>
            )}
          </p>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Chip key={tab} active={status === tab} onClick={() => pick(tab)}>
            {t(`tabs.${tab}`)}
          </Chip>
        ))}
      </div>

      {isPending && items.length === 0 ? (
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-[68px] w-full rounded-[13px]" />
          <Skeleton className="h-[68px] w-full rounded-[13px]" />
          <Skeleton className="h-[68px] w-full rounded-[13px]" />
        </div>
      ) : isError ? (
        <div className="rounded-[13px] border-[1.5px] border-(--ssz-border-default) px-4 py-8 text-center">
          <p className="text-sm text-(--ssz-text-secondary)">{t('failed')}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[13px] border-[1.5px] border-(--ssz-border-default) px-4 py-10 text-center">
          <p className="text-sm font-semibold">
            {status === 'all' ? t('empty.title') : t('empty.filteredTitle')}
          </p>
          <p className="mx-auto mt-1.5 max-w-[46ch] text-[13px] text-(--ssz-text-secondary)">
            {status === 'all' ? t('empty.body') : t('empty.filteredBody')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {groupByLesson(items).map((group) =>
            group.items.length === 1 ? (
              <MyRow
                key={group.key}
                submission={group.items[0] as MySubmission}
                open={isOpen(group.items[0] as MySubmission, toggled, focused)}
                onToggle={() => setToggled(flip(group.items[0] as MySubmission, toggled, focused))}
              />
            ) : (
              <section key={group.key} className="flex flex-col gap-2">
                {/*
                  A lesson handed in at one sitting is one act. The heading carries the
                  course and lesson once, and the rows under it carry only what differs.
                */}
                <div className="flex items-baseline justify-between gap-3 px-1">
                  <h2 className="truncate text-[13px] font-semibold">
                    {[group.course, group.lesson].filter(Boolean).join(' · ')}
                  </h2>
                  <span className="shrink-0 text-[11.5px] text-(--ssz-text-muted)">
                    {t('group.count', { count: group.items.length })}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {group.items.map((item) => (
                    <MyRow
                      key={item.id}
                      submission={item}
                      showPath={false}
                      open={isOpen(item, toggled, focused)}
                      onToggle={() => setToggled(flip(item, toggled, focused))}
                    />
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Returned work opens itself, so does the card a notification pointed at, and everything
 * else opens when asked.
 *
 * The default is per row rather than per screen, and it is the whole reason the state map
 * holds explicit `false`: a learner who closed a returned card has closed it, and a screen
 * that reopened it on the next render would be insisting.
 */
function isOpen(
  submission: MySubmission,
  toggled: Record<string, boolean>,
  focused: string | null,
): boolean {
  return toggled[submission.id] ?? (submission.status === 'returned' || submission.id === focused);
}

function flip(
  submission: MySubmission,
  toggled: Record<string, boolean>,
  focused: string | null,
): Record<string, boolean> {
  return { ...toggled, [submission.id]: !isOpen(submission, toggled, focused) };
}
