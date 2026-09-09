'use client';

import { useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CourseTimeline } from './course-timeline';
import { LessonLog } from './lesson-log';
import { SessionEditor, type AssignableTeacher } from './session-editor';
import { AssessmentPanel, CoveragePanel, WhoTaughtPanel } from './schedule-panels';
import { NextSessionCard } from './next-session-card';
import { ScheduleStat } from './schedule-stat';
import {
  courseSpan,
  deliveryStats,
  nextSession,
  weeklyRhythm,
  type LogFilter,
} from '../lib/session-derive';
import { dayMonth, weekdayDayMonth } from '../lib/session-format';
import type { Group, OutlineUnit, RosterStudent, Session, Weekday } from '../types';

const DAY_ORDER: Record<Weekday, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

type Props = {
  group: Group;
  /** Every session of the group — the log reads a whole course, not a window. */
  sessions: Session[];
  /** Units of the published course, for naming what a session teaches. */
  units: OutlineUnit[];
  /** The school's pass mark; an exam may override it for itself. */
  passMark: number;
  /** The group's students — the exam results table and the turnout hint read it. */
  roster: RosterStudent[];
  /** Every teacher of the school: cover is often somebody outside the group. */
  schoolTeachers: AssignableTeacher[];
  schoolId: string;
  /** The signed-in user, so a teacher is shown what they may actually change. */
  viewerId: string | null;
  canManage: boolean;
  onEditSchedule: () => void;
};

/**
 * Schedule & log: the rhythm the group runs on, and the record of what actually
 * happened. Every number here is derived from the sessions (see `session-derive`)
 * — nothing is counted twice or stored, so this tab and Materials cannot
 * disagree about the same group.
 */
export function GroupScheduleTab({
  group,
  sessions,
  units,
  passMark,
  roster,
  schoolTeachers,
  schoolId,
  viewerId,
  canManage,
  onEditSchedule,
}: Props) {
  const t = useTranslations('Groups');
  const locale = useLocale();
  const [filter, setFilter] = useState<LogFilter>('recent');
  const logRef = useRef<HTMLDivElement>(null);
  // `null` while closed, a session id to edit one, and 'new' to add an extra.
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  const viewer = { canManage, userId: viewerId };

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
  // Topics already spoken for, so the picker can say so before a second session
  // is given the same one.
  const taughtItemIds = new Set(
    sessions
      .filter((s) => s.id !== editing && s.contentLessonId)
      .map((s) => s.contentLessonId as string),
  );


  // The one call to action on the tab: it does not navigate anywhere, it turns
  // the log into the list of what needs attention.
  const showIssues = () => {
    setFilter('issues');
    logRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
          value={
            span.total === 0
              ? '—'
              : t('schedule.weekOf', { current: span.currentWeek, total: span.totalWeeks })
          }
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
            <button
              type="button"
              onClick={showIssues}
              className="mt-2 text-left text-xs font-medium text-warning-700 underline-offset-2 hover:underline dark:text-warning-400"
            >
              {t('schedule.withoutTopic', { n: delivery.withoutTopic })}
            </button>
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
          onEdit={setEditing}
        />
      )}

      {/* Block 5 — the whole course at a glance */}
      <CourseTimeline
        sessions={sessions}
        units={units}
        staff={staff}
        perWeek={rhythm.perWeek}
        canManage={canManage}
        onEditSession={setEditing}
        onAddSession={() => setEditing('new')}
      />

      {/* Blocks 6 and 7 — the record, and what it adds up to */}
      <div
        ref={logRef}
        className="grid scroll-mt-4 grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-[18px]"
      >
        <LessonLog
          sessions={sessions}
          units={units}
          teachers={group.teachers}
          staff={staff}
          studentCount={group.studentCount}
          filter={filter}
          onFilterChange={setFilter}
          onEditSession={setEditing}
        />

        <div className="flex flex-col gap-[18px]">
          <AssessmentPanel
            sessions={sessions}
            units={units}
            passMark={passMark}
            onEditSession={setEditing}
          />
          <WhoTaughtPanel sessions={sessions} teachers={group.teachers} staff={staff} />
          <CoveragePanel sessions={sessions} units={units} />
        </div>
      </div>

      <SessionEditor
        key={editing ?? 'closed'}
        open={editing !== null}
        onOpenChange={(open) => setEditing(open ? editing : null)}
        session={sessions.find((x) => x.id === editing) ?? null}
        group={group}
        schoolId={schoolId}
        units={units}
        roster={roster}
        teachers={schoolTeachers}
        passMark={passMark}
        taughtItemIds={taughtItemIds}
        viewer={viewer}
      />
    </div>
  );
}
