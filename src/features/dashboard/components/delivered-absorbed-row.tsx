'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';

import { WidgetCard } from './widget-card';
import { WidgetEmptyState } from './widget-empty-state';
import { Segmented } from '@/components/ui/segmented';
import { DualBar } from '@/features/analytics/components/dual-bar';
import { Note } from '@/features/analytics/components/note';
import { wsHref } from '@/features/workspaces/lib/href';
import { track } from '@/lib/analytics/track';
import type { WidgetData } from '../types';
import type { GroupGap } from '@/lib/dashboard/types';

type Sort = 'gap' | 'all';

type Props = {
  gaps: WidgetData<GroupGap[]>;
  workspaceId: string;
};

/** Points between what a group was taught and what its median learner took away. */
function gapOf(group: GroupGap): number | null {
  if (group.delivered === null || group.absorbed === null) return null;
  return group.delivered - group.absorbed;
}

/**
 * Screen D — which group is furthest from what it was taught (plan 58, §D).
 *
 * Two rules from the brief hold the shape of this widget. A group with no course and a
 * group nobody has attempted anything in go under their own heading rather than to the
 * bottom of the sort: sorted in, they read as "everything is wrong here", when the truth
 * is that there is nothing to compare yet (§O7). And the colour of the gap is an accent
 * only — the number carries it, so the row still says the same thing in monochrome.
 */
export function DeliveredAbsorbedRow({ gaps, workspaceId }: Props) {
  const t = useTranslations('Analytics.groupGaps');
  const [sort, setSort] = useState<Sort>('gap');

  const { comparable, notComparable, total } = useMemo(() => {
    const all = gaps.status === 'ok' ? gaps.data : [];
    const comparable = all.filter((group) => group.state === 'ok');
    const notComparable = all.filter((group) => group.state !== 'ok');
    if (sort === 'gap') {
      comparable.sort((a, b) => (gapOf(b) ?? 0) - (gapOf(a) ?? 0));
    }
    return { comparable, notComparable, total: all.length };
  }, [gaps, sort]);

  if (gaps.status === 'unavailable') {
    return <WidgetCard title={t('title')} loading />;
  }

  return (
    <WidgetCard
      title={t('title')}
      subtitle={t('subtitle')}
      headerRight={
        total > 1 && (
          <Segmented
            size="sm"
            aria-label={t('sortLabel')}
            value={sort}
            onValueChange={setSort}
            options={[
              { value: 'gap', label: t('sortByGap') },
              { value: 'all', label: t('sortAll') },
            ]}
          />
        )
      }
    >
      {total === 0 ? (
        <WidgetEmptyState title={t('emptyTitle')} body={t('emptyBody')} />
      ) : (
        <div className="space-y-3">
          <ul role="list" className="divide-y divide-border">
            {comparable.map((group) => (
              <GapRow key={group.groupId} group={group} workspaceId={workspaceId} sort={sort} />
            ))}
          </ul>

          {notComparable.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
                {t('notComparable')}
              </p>
              <ul role="list" className="divide-y divide-border">
                {notComparable.map((group) => (
                  <GapRow key={group.groupId} group={group} workspaceId={workspaceId} sort={sort} />
                ))}
              </ul>
              <Note>{t('notComparableNote')}</Note>
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}

function GapRow({
  group,
  workspaceId,
  sort,
}: {
  group: GroupGap;
  workspaceId: string;
  /** Travels with the click: which ordering a row was opened from is the useful half. */
  sort: 'gap' | 'all';
}) {
  const t = useTranslations('Analytics.groupGaps');
  const gap = gapOf(group);

  // Accent only. A reader in monochrome, or one who cannot tell the three apart, still
  // has the number and the two bars.
  const tone =
    gap === null
      ? 'text-(--ssz-text-muted)'
      : gap >= 25
        ? 'text-error-600 dark:text-error-400'
        : gap >= 12
          ? 'text-warning-600 dark:text-warning-400'
          : 'text-success-600 dark:text-success-400';

  const reason =
    group.state === 'noCourse'
      ? t('noCourse')
      : group.delivered === null
        ? t('noTimetable')
        : t('noAttempts', { delivered: group.delivered });

  return (
    <li className="min-w-0">
      <Link
        href={wsHref(workspaceId, `groups/${group.groupId}?tab=progress`)}
        onClick={() => track({ name: 'gap_widget_group_opened', groupId: group.groupId, sort })}
        className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-0 flex-1 basis-full sm:basis-0">
          <p className="truncate text-sm font-medium text-(--ssz-text-primary)">{group.name}</p>
          <p className="truncate text-xs text-(--ssz-text-muted)">
            {group.state === 'ok'
              ? `${group.courseTitle ?? t('untitledCourse')} · ${t('students', { count: group.students })}`
              : reason}
          </p>
        </div>

        <DualBar
          // The bars take the share, the row prints the percent: one number, two scales,
          // converted in the one place that needs it.
          delivered={group.delivered === null ? null : group.delivered / 100}
          absorbed={group.absorbed}
          width={120}
          label={t('barsLabel', {
            name: group.name,
            delivered: group.delivered ?? 0,
            absorbed: group.absorbed ?? 0,
          })}
        />

        <span className={`w-14 shrink-0 text-right text-sm font-semibold tabular-nums ${tone}`}>
          {gap === null ? '—' : t('gapPoints', { points: Math.round(gap) })}
        </span>

        <ChevronRight className="size-4 shrink-0 text-(--ssz-text-muted)" aria-hidden="true" />
      </Link>
    </li>
  );
}
