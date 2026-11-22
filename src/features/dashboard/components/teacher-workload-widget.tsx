import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';

import { wsHref } from '@/features/workspaces/lib/href';
import { WidgetCard } from './widget-card';
import { WidgetEmptyState } from './widget-empty-state';
import { TeacherWorkloadBar } from './teacher-workload-bar';
import type { WidgetData, TeacherWorkloadData } from '../types';

type TeacherWorkloadWidgetProps = {
  teacherWorkload: WidgetData<TeacherWorkloadData>;
  workspaceId: string;
};

export function TeacherWorkloadWidget({ teacherWorkload, workspaceId }: TeacherWorkloadWidgetProps) {
  const t = useTranslations('School.dashboard.workload');
  const timetableHref = wsHref(workspaceId, 'groups/timetable');

  if (teacherWorkload.status === 'unavailable') {
    return <WidgetCard title={t('title')} unavailable />;
  }

  if (teacherWorkload.status === 'empty') {
    return (
      <WidgetCard title={t('title')}>
        <WidgetEmptyState title={t('empty')} />
      </WidgetCard>
    );
  }

  const { overloadedCount, avgLoadPct, conflictCount, teachers } = teacherWorkload.data;

  // Sort by pct desc; show top 5
  const sorted = [...teachers].sort((a, b) => b.pct - a.pct).slice(0, 5);

  const subtitle =
    overloadedCount > 0
      ? t('over', { count: overloadedCount, pct: avgLoadPct })
      : t('avg', { pct: avgLoadPct });

  return (
    <WidgetCard
      title={t('title')}
      subtitle={subtitle}
      headerRight={
        <Link
          href={timetableHref}
          className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {t('timetable')}
        </Link>
      }
    >
      <ul className="divide-y divide-border">
        {sorted.map((teacher) => (
          <TeacherWorkloadBar key={teacher.id} teacher={teacher} />
        ))}
      </ul>

      {conflictCount > 0 && (
        <div className="mt-3 flex items-center justify-between text-xs text-(--ssz-text-muted)">
          <span>{t('conflicts', { count: conflictCount })}</span>
          <Link
            href={timetableHref}
            className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {t('open')}
          </Link>
        </div>
      )}
    </WidgetCard>
  );
}
