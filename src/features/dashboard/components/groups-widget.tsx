import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';

import { Button } from '@/components/ui/button';
import { wsHref } from '@/features/workspaces/lib/href';
import { WidgetCard } from './widget-card';
import { WidgetEmptyState } from './widget-empty-state';
import { GroupHealthRow } from './group-health-row';
import type { DashboardRole, WidgetData, GroupsHealthData } from '../types';

type GroupsWidgetProps = {
  groupsHealth: WidgetData<GroupsHealthData>;
  role: DashboardRole;
  workspaceId: string;
};

export function GroupsWidget({ groupsHealth, role, workspaceId }: GroupsWidgetProps) {
  const t = useTranslations('School.dashboard.groups');
  const groupsHref = wsHref(workspaceId, 'groups');
  const isTeacher = role === 'teacher';

  if (groupsHealth.status === 'unavailable') {
    return <WidgetCard title={isTeacher ? t('myTitle') : t('title')} unavailable />;
  }

  if (groupsHealth.status === 'empty') {
    return (
      <WidgetCard title={isTeacher ? t('myTitle') : t('title')}>
        {/* A teacher does not create groups — the school assigns them. */}
        <WidgetEmptyState
          title={isTeacher ? t('emptyMine') : t('empty')}
          cta={
            isTeacher ? undefined : (
              <Button size="sm" asChild>
                <Link href={`${groupsHref}/new`}>{t('newGroup')}</Link>
              </Button>
            )
          }
        />
      </WidgetCard>
    );
  }

  const { activeCount, attentionCount, groups } = groupsHealth.data;
  const attentionGroups = groups.filter((g) => g.alerts.length > 0);
  const allHealthy = attentionCount === 0;

  const title = isTeacher
    ? t('myTitle')
    : t('titleCounts', { active: activeCount, attention: attentionCount });

  return (
    <WidgetCard
      title={title}
      headerRight={
        <Link
          href={groupsHref}
          className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {t('all')}
        </Link>
      }
    >
      {allHealthy ? (
        <div className="flex items-center gap-2 py-2 text-sm text-success-700 dark:text-success-400">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          <span>{t('allHealthy', { count: activeCount })}</span>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {(isTeacher ? groups : attentionGroups).map((group) => (
              <GroupHealthRow key={group.id} group={group} workspaceId={workspaceId} />
            ))}
          </ul>

          {!isTeacher && (
            <div className="mt-3 flex items-center justify-between text-xs text-(--ssz-text-muted)">
              <span>
                {t('summary', { healthy: activeCount - attentionCount, attention: attentionCount })}
              </span>
              <Link
                href={groupsHref}
                className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {t('resolve')}
              </Link>
            </div>
          )}
        </>
      )}
    </WidgetCard>
  );
}
