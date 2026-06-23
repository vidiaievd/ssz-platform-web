import Link from 'next/link';

import { Skeleton } from '@/components/ui/skeleton';
import { WidgetCard } from './widget-card';
import { WidgetEmptyState } from './widget-empty-state';
import { TeacherWorkloadBar } from './teacher-workload-bar';
import type { WidgetData, TeacherWorkloadData } from '../types';

type TeacherWorkloadWidgetProps = {
  teacherWorkload: WidgetData<TeacherWorkloadData>;
  schoolSlug: string;
};

function TeacherWorkloadSkeleton() {
  return (
    <WidgetCard title="Teacher workload">
      <ul className="divide-y divide-border">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="flex items-center gap-3 py-2.5">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-2 w-full" />
            </div>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

export function TeacherWorkloadWidget({ teacherWorkload, schoolSlug }: TeacherWorkloadWidgetProps) {
  const timetableHref = `/school/${schoolSlug}/groups/timetable`;

  if (teacherWorkload.status === 'unavailable') {
    return <TeacherWorkloadSkeleton />;
  }

  if (teacherWorkload.status === 'empty') {
    return (
      <WidgetCard title="Teacher workload">
        <WidgetEmptyState title="No assignments yet" />
      </WidgetCard>
    );
  }

  const { overloadedCount, avgLoadPct, conflictCount, teachers } = teacherWorkload.data;

  // Sort by pct desc; show top 5
  const sorted = [...teachers].sort((a, b) => b.pct - a.pct).slice(0, 5);

  const subtitle =
    overloadedCount > 0
      ? `${overloadedCount} over capacity · avg ${avgLoadPct}%`
      : `avg ${avgLoadPct}%`;

  return (
    <WidgetCard
      title="Teacher workload"
      subtitle={subtitle}
      headerRight={
        <Link
          href={timetableHref}
          className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Timetable
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
          <span>{conflictCount} time {conflictCount === 1 ? 'conflict' : 'conflicts'} this week</span>
          <Link
            href={timetableHref}
            className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Open timetable →
          </Link>
        </div>
      )}
    </WidgetCard>
  );
}
