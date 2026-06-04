import { Video, MapPin, Users, AlertTriangle } from 'lucide-react';

import { WidgetCard } from './widget-card';
import { WidgetEmptyState } from './widget-empty-state';
import type { WidgetData, TodaysClass } from '../types';

type TodaysClassesCardProps = {
  todaysClasses: WidgetData<TodaysClass[]>;
  teacherView?: boolean;
};

function statusStyles(status: TodaysClass['status']): { time: string; badge?: string; badgeText?: string } {
  switch (status) {
    case 'now':
      return { time: 'text-error-600 font-bold', badge: 'bg-error-100 text-error-700', badgeText: 'now' };
    case 'low':
      return { time: 'text-(--ssz-text-primary)', badge: 'bg-warning-100 text-warning-700', badgeText: 'low' };
    default:
      return { time: 'text-(--ssz-text-primary)' };
  }
}

export function TodaysClassesCard({ todaysClasses, teacherView }: TodaysClassesCardProps) {
  if (todaysClasses.status === 'unavailable') {
    // Scheduling service not built yet — don't render at all
    return null;
  }

  const classes = todaysClasses.status === 'ok' ? todaysClasses.data : [];
  const visible = teacherView ? classes.slice(0, 3) : classes;

  return (
    <WidgetCard
      title="Today's classes"
      subtitle={teacherView ? 'My classes' : undefined}
      empty={
        visible.length === 0 ? (
          <WidgetEmptyState title="No classes today" body="Your schedule is clear for today." />
        ) : undefined
      }
    >
      {visible.length > 0 && (
        <ul role="list" aria-label="Today's classes" className="divide-y divide-border -mx-4 -mb-4">
          {visible.map((cls) => {
            const styles = statusStyles(cls.status);
            const underEnrolled = cls.students / cls.cap < 0.6;
            return (
              <li key={cls.id} className="flex items-start gap-3 px-4 py-3 min-h-[44px]">
                <div className="shrink-0 w-14 text-center">
                  <p className={`text-sm font-mono ${styles.time}`}>{cls.time}</p>
                  {styles.badge && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${styles.badge}`}>
                      {styles.badgeText}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-(--ssz-text-primary) truncate">{cls.name}</p>
                  <p className="font-mono text-[11px] text-(--ssz-text-muted) truncate">
                    {cls.mode === 'in-person' ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-2.5" aria-hidden="true" />
                        {cls.room}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Video className="size-2.5" aria-hidden="true" />
                        Online
                      </span>
                    )}
                    {' · '}
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-2.5" aria-hidden="true" />
                      {cls.students}/{cls.cap}
                      {underEnrolled && (
                        <AlertTriangle className="size-2.5 text-warning-500" aria-label="under-enrolled" />
                      )}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}
