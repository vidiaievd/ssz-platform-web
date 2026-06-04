import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WidgetCard } from './widget-card';
import { WidgetEmptyState } from './widget-empty-state';
import { GroupHealthRow } from './group-health-row';
import type { DashboardRole, WidgetData, GroupsHealthData } from '../types';

type GroupsWidgetProps = {
  groupsHealth: WidgetData<GroupsHealthData>;
  role: DashboardRole;
  schoolSlug: string;
};

function GroupsWidgetSkeleton() {
  return (
    <WidgetCard title="Groups">
      <ul className="divide-y divide-border">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-3 py-2.5">
            <Skeleton className="size-8 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

export function GroupsWidget({ groupsHealth, role, schoolSlug }: GroupsWidgetProps) {
  const groupsHref = `/school/${schoolSlug}/groups`;
  const isTeacher = role === 'teacher';

  if (groupsHealth.status === 'unavailable') {
    return <GroupsWidgetSkeleton />;
  }

  if (groupsHealth.status === 'empty') {
    return (
      <WidgetCard title={isTeacher ? 'My groups' : 'Groups'}>
        <WidgetEmptyState
          title="No groups yet"
          cta={
            <Button size="sm" asChild>
              <Link href={`${groupsHref}/new`}>New group</Link>
            </Button>
          }
        />
      </WidgetCard>
    );
  }

  const { activeCount, attentionCount, groups } = groupsHealth.data;
  const attentionGroups = groups.filter((g) => g.alerts.length > 0);
  const allHealthy = attentionCount === 0;

  const title = isTeacher
    ? 'My groups'
    : `Groups · ${activeCount} active · ${attentionCount} need attention`;

  return (
    <WidgetCard
      title={title}
      headerRight={
        <Link
          href={groupsHref}
          className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          All groups →
        </Link>
      }
    >
      {allHealthy ? (
        <div className="flex items-center gap-2 py-2 text-sm text-success-700 dark:text-success-400">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          <span>
            All {activeCount} groups are staffed, scheduled and within capacity.
          </span>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {(isTeacher ? groups : attentionGroups).map((group) => (
              <GroupHealthRow key={group.id} group={group} schoolSlug={schoolSlug} />
            ))}
          </ul>

          {!isTeacher && (
            <div className="mt-3 flex items-center justify-between text-xs text-(--ssz-text-muted)">
              <span>
                {activeCount - attentionCount} healthy · {attentionCount} need attention
              </span>
              <Link
                href={groupsHref}
                className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Resolve in Groups →
              </Link>
            </div>
          )}
        </>
      )}
    </WidgetCard>
  );
}
