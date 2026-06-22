import { getTranslations } from 'next-intl/server';
import { Clock } from 'lucide-react';

import { TimetableGrid } from './timetable-grid';
import type { TimetableTeacher } from '../types';

type Props = {
  teacher: TimetableTeacher;
  schoolSlug: string;
};

export async function MyScheduleView({ teacher, schoolSlug }: Props) {
  const t = await getTranslations('Groups.mySchedule');
  const { hours, max, groups, conflicts, lessons } = teacher;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-border">
        <p className="flex-1 min-w-0 text-sm text-(--ssz-text-muted)">
          {hours.toFixed(1)}/{max}h · {t('groupsCount', { count: groups })}
        </p>
        {conflicts > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-error-100 dark:bg-error-900/40 text-error-700 dark:text-error-400 px-2.5 py-1 text-xs font-semibold">
            <Clock className="size-3.5" aria-hidden="true" />
            {t('clashes', { count: conflicts })}
          </span>
        )}
      </div>

      {lessons.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-center">
          <p className="text-sm text-(--ssz-text-muted)">{t('noSchedule')}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4 overflow-x-auto">
          <TimetableGrid teacher={teacher} schoolSlug={schoolSlug} />
        </div>
      )}
    </div>
  );
}
