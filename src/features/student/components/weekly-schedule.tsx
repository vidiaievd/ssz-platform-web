'use client';

import { useTranslations } from 'next-intl';
import { Calendar } from 'lucide-react';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ScheduleSlot, NextLesson } from '../types';

interface WeeklyScheduleProps {
  schedule: ScheduleSlot[];
  nextLesson: NextLesson | null;
}

const WEEKDAY_ORDER: ScheduleSlot['day'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function isNextSlot(slot: ScheduleSlot, nextLesson: NextLesson | null): boolean {
  if (!nextLesson) return false;
  return slot.day === nextLesson.day && slot.start === nextLesson.start && slot.end === nextLesson.end;
}

/** The group's recurring weekly slots, with the upcoming occurrence highlighted. */
export function WeeklySchedule({ schedule, nextLesson }: WeeklyScheduleProps) {
  const t = useTranslations('Student.SchoolDetail');

  const sorted = [...schedule].sort((a, b) => {
    const dayDiff = WEEKDAY_ORDER.indexOf(a.day) - WEEKDAY_ORDER.indexOf(b.day);
    return dayDiff !== 0 ? dayDiff : a.start.localeCompare(b.start);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('scheduleTitle')}</CardTitle>
      </CardHeader>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('scheduleEmpty')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {sorted.map((slot, i) => {
            const isNext = isNextSlot(slot, nextLesson);
            return (
              <li
                key={`${slot.day}-${slot.start}-${i}`}
                className={cn(
                  'flex items-center justify-between gap-3 py-3',
                  isNext && 'rounded-md bg-primary-50 px-3 -mx-3',
                )}
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">{t(`weekday.${slot.day}`)}</p>
                    <p className="text-xs text-muted-foreground">
                      {slot.start}–{slot.end} · {slot.room}
                    </p>
                  </div>
                </div>
                {isNext && <Badge variant="primary">{t('nextLessonBadge')}</Badge>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
