'use client';

import { Calendar, Clock, MapPin, Pencil, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Slot, Lesson, Weekday } from '../types';

const DAY_ORDER: Record<Weekday, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

const DAY_FULL: Record<Weekday, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday',
  Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};

type Props = {
  slots: Slot[];
  lessons: Lesson[];
  canManage: boolean;
  onEditSchedule: () => void;
};

export function GroupScheduleTab({ slots, lessons, canManage, onEditSchedule }: Props) {
  const t = useTranslations('Groups');
  const sortedSlots = [...slots].sort(
    (a, b) => DAY_ORDER[a.day] - DAY_ORDER[b.day] || a.start.localeCompare(b.start),
  );

  return (
    <div className="space-y-6">
      {/* Recurring slots */}
      <section aria-labelledby="schedule-slots-heading">
        <div className="flex items-center justify-between mb-3">
          <h3 id="schedule-slots-heading" className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
            {t('schedule.recurringHeading')}
          </h3>
          {canManage && (
            <Button variant="outline" size="sm" onClick={onEditSchedule}>
              <Pencil className="size-3.5 mr-1.5" aria-hidden="true" />
              {t('schedule.editButton')}
            </Button>
          )}
        </div>

        {sortedSlots.length === 0 ? (
          <p className="text-sm text-(--ssz-text-muted) italic px-3 py-2">
            {t('schedule.noSlots')}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedSlots.map((slot, i) => (
              <div
                key={slot.id ?? i}
                className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex-1 grid grid-cols-3 gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-(--ssz-text-primary)">
                    <Calendar className="size-3.5 text-(--ssz-text-muted)" aria-hidden="true" />
                    {DAY_FULL[slot.day]}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-(--ssz-text-secondary)">
                    <Clock className="size-3.5 text-(--ssz-text-muted)" aria-hidden="true" />
                    {slot.start} – {slot.end}
                  </span>
                  {slot.room && (
                    <span className="flex items-center gap-1.5 text-sm text-(--ssz-text-secondary)">
                      <MapPin className="size-3.5 text-(--ssz-text-muted)" aria-hidden="true" />
                      {slot.room}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming lessons */}
      <section aria-labelledby="schedule-lessons-heading">
        <h3 id="schedule-lessons-heading" className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-3">
          {t('schedule.upcomingHeading')}
        </h3>

        {lessons.length === 0 ? (
          <p className="text-sm text-(--ssz-text-muted) italic px-3 py-2">
            {t('schedule.noLessons')}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className={cn(
                  'flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3',
                  lesson.isSubstitute && 'border-warning-200 bg-warning-50 dark:border-warning-800 dark:bg-warning-900/10',
                )}
              >
                <div className="flex-1 min-w-0 grid grid-cols-[auto_1fr_auto] items-center gap-x-4">
                  <span className="text-sm font-medium text-(--ssz-text-primary) whitespace-nowrap">
                    {lesson.date}
                  </span>
                  <span className="text-sm text-(--ssz-text-secondary) whitespace-nowrap">
                    {lesson.start} – {lesson.end}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-(--ssz-text-muted)">
                    <Users className="size-3" aria-hidden="true" />
                    {lesson.teacherName}
                    {lesson.isSubstitute && (
                      <span className="ml-1 rounded-full bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-400 px-1.5 py-0.5 text-[10px] font-semibold">
                        {t('schedule.sub')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
