'use client';

import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CourseTimeline } from './course-timeline';
import { NextSessionCard } from './next-session-card';
import { ScheduleStat } from './schedule-stat';
import { courseSpan, deliveryStats, nextSession, weeklyRhythm } from '../lib/session-derive';
import { dayMonth, weekdayDayMonth } from '../lib/session-format';
import type { Group, OutlineUnit, Session, Weekday } from '../types';

const DAY_ORDER: Record<Weekday, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

type Props = {
  group: Group;
  /** Every session of the group — the log reads a whole course, not a window. */
  sessions: Session[];
  /** Units of the published course, for naming what a session teaches. */
  units: OutlineUnit[];
  canManage: boolean;
  onEditSchedule: () => void;
};

/**
 * Schedule & log: the rhythm the group runs on, and the record of what actually
 * happened. Every number here is derived from the sessions (see `session-derive`)
 * — nothing is counted twice or stored, so this tab and Materials cannot
 * disagree about the same group.
 */
export function GroupScheduleTab({ group, sessions, units, canManage, onEditSchedule }: Props) {
  const t = useTranslations('Groups');
  const locale = useLocale();

  const staff = {
    primaryId: group.teachers.find((x) => x.role === 'primary')?.userId ?? null,
    coPrimaryId: group.teachers.find((x) => x.role === 'co-primary')?.userId ?? null,
  };

  const sortedSlots = [...group.slots].sort(
    (a, b) => DAY_ORDER[a.day] - DAY_ORDER[b.day] || a.start.localeCompare(b.start),
  );
  const rhythm = weeklyRhythm(group.slots);
  const span = courseSpan(sessions);
  const delivery = deliveryStats(sessions, staff);
  const next = nextSession(sessions);

  // The editor arrives with its own phase; until then every entry point says so
  // rather than silently doing nothing.
  const openEditor = () => toast.info(t('schedule.editorSoon'));

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-[18px]">
        {/* Block 1 — the pattern the group is supposed to run on */}
        <ScheduleStat
          overline={t('schedule.rhythmHeading')}
          value={t('schedule.perWeek', { n: rhythm.perWeek })}
          caption={t('schedule.rhythmCaption', {
            hours: rhythm.weeklyHours,
            mode: group.mode === 'online' ? t('row.online') : t('row.inPerson'),
          })}
        >
          <ul className="mt-3 flex flex-col gap-1 text-xs text-(--ssz-text-secondary)">
            {sortedSlots.map((slot, i) => (
              <li key={slot.id ?? i} className="flex items-center gap-2">
                <span className="w-[30px] font-bold text-primary-600">{slot.day}</span>
                <span className="tabular-nums">
                  {slot.start}–{slot.end}
                </span>
                {slot.room && (
                  <span className="ml-auto whitespace-nowrap text-(--ssz-text-muted)">
                    {slot.room}
                  </span>
                )}
              </li>
            ))}
            {sortedSlots.length === 0 && (
              <li className="italic text-(--ssz-text-muted)">{t('schedule.noSlots')}</li>
            )}
          </ul>
          {canManage && (
            <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={onEditSchedule}>
              <Pencil className="size-3.5 mr-1.5" aria-hidden="true" />
              {t('schedule.changePattern')}
            </Button>
          )}
        </ScheduleStat>

        {/* Block 2 — where the course has got to */}
        <ScheduleStat
          overline={t('schedule.spanHeading')}
          value={t('schedule.weekOf', { current: span.currentWeek, total: span.totalWeeks })}
          caption={
            span.firstDate && span.lastDate
              ? t('schedule.spanCaption', {
                  from: dayMonth(span.firstDate, locale),
                  to: dayMonth(span.lastDate, locale),
                  done: span.done,
                  total: span.total,
                })
              : t('schedule.noSessions')
          }
        >
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary-500 transition-[width]"
              style={{ width: `${span.pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-(--ssz-text-muted)">
            {next
              ? t('schedule.nextOn', {
                  date: weekdayDayMonth(next.date, locale),
                  time: next.start,
                })
              : t('schedule.courseFinished')}
          </p>
        </ScheduleStat>

        {/* Block 3 — how delivery is actually going */}
        <ScheduleStat
          overline={t('schedule.deliveryHeading')}
          value={
            delivery.averageAttendance === null
              ? '—'
              : `${delivery.averageAttendance}/${group.studentCount}`
          }
          caption={t('schedule.averageAttendance')}
        >
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="success">{t('schedule.heldCount', { n: delivery.held })}</Badge>
            <Badge variant="warning">{t('schedule.subCount', { n: delivery.substituted })}</Badge>
            <Badge variant={delivery.cancelled > 0 ? 'error' : 'muted'}>
              {t('schedule.cancelledCount', { n: delivery.cancelled })}
            </Badge>
          </div>
          {delivery.withoutTopic > 0 && (
            <p className="mt-2 text-xs text-warning-700 dark:text-warning-400">
              {t('schedule.withoutTopic', { n: delivery.withoutTopic })}
            </p>
          )}
        </ScheduleStat>
      </div>

      {/* Block 4 — the one session anybody can still act on */}
      {next && (
        <NextSessionCard
          session={next}
          units={units}
          teachers={group.teachers}
          canManage={canManage}
          onEdit={openEditor}
        />
      )}

      {/* Block 5 — the whole course at a glance */}
      <CourseTimeline
        sessions={sessions}
        units={units}
        staff={staff}
        perWeek={rhythm.perWeek}
        canManage={canManage}
        onEditSession={openEditor}
        onAddSession={openEditor}
      />
    </div>
  );
}
