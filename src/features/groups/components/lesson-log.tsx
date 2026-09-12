'use client';

import { useState } from 'react';
import { CalendarDays, Pencil } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Avatar } from '@/components/ui/avatar';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import {
  examStats,
  filterLog,
  gradeTone,
  stateOf,
  nextSession,
  topicOf,
  type LogFilter,
  type SessionState,
  type TeachingStaff,
} from '../lib/session-derive';
import { dayMonth, weekdayShort } from '../lib/session-format';
import type { GroupTeacher, OutlineUnit, Session } from '../types';

/** Rows shown before the reader has to ask for the rest. */
const PAGE = 6;

const STATE_TONE: Record<SessionState, BadgeProps['variant']> = {
  held: 'success',
  sub: 'warning',
  cancelled: 'error',
  next: 'primary',
  planned: 'muted',
};

/**
 * What kind of material a session covers, in the terms a teacher thinks in.
 * Lesson kinds and item types share one scale here — the log asks "what sort of
 * work was this", and `audio` and `vocabulary_list` are both answers to it.
 */
type KindKey =
  | 'reading'
  | 'listening'
  | 'video'
  | 'speaking'
  | 'vocabulary'
  | 'grammar'
  | 'exercise';

const KIND_LABEL: Record<string, { key: KindKey; tone: BadgeProps['variant'] }> = {
  text: { key: 'reading', tone: 'muted' },
  video: { key: 'video', tone: 'error' },
  audio: { key: 'listening', tone: 'warning' },
  live: { key: 'speaking', tone: 'success' },
  lesson: { key: 'reading', tone: 'muted' },
  vocabulary_list: { key: 'vocabulary', tone: 'primary' },
  grammar_rule: { key: 'grammar', tone: 'info' },
  exercise: { key: 'exercise', tone: 'muted' },
};

type Props = {
  sessions: Session[];
  units: OutlineUnit[];
  teachers: GroupTeacher[];
  staff: TeachingStaff;
  /** Group size — the denominator of the turnout column. */
  studentCount: number;
  filter: LogFilter;
  onFilterChange: (filter: LogFilter) => void;
  onEditSession: (sessionId: string) => void;
};

/**
 * The record of what actually happened: who taught, what topic, how the group
 * did. Four views of one list rather than four lists — `Issues` is the same
 * sessions read for what went wrong, not a separate store of problems.
 */
export function LessonLog({
  sessions,
  units,
  teachers,
  staff,
  studentCount,
  filter,
  onFilterChange,
  onEditSession,
}: Props) {
  const t = useTranslations('Groups');
  const locale = useLocale();

  return (
    <section
      aria-labelledby="lesson-log-heading"
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 id="lesson-log-heading" className="text-sm font-semibold text-(--ssz-text-primary)">
            {t('schedule.logHeading')}
          </h3>
          <p className="mt-0.5 text-xs text-(--ssz-text-muted)">{t('schedule.logCaption')}</p>
        </div>
        <Segmented
          size="sm"
          aria-label={t('schedule.logHeading')}
          value={filter}
          onValueChange={onFilterChange}
          options={(['recent', 'issues', 'exams', 'upcoming'] as const).map((value) => ({
            value,
            label: t(`schedule.filter.${value}`),
          }))}
        />
      </div>

      {/* Keyed on the filter: a new filter is a new question, and answering it
          half-expanded would carry the previous answer's length over. */}
      <LogBody
        key={filter}
        rows={filterLog(sessions, filter, staff)}
        next={nextSession(sessions)}
        units={units}
        teachers={teachers}
        staff={staff}
        studentCount={studentCount}
        locale={locale}
        onEditSession={onEditSession}
      />
    </section>
  );
}

type BodyProps = {
  rows: Session[];
  next: Session | null;
  units: OutlineUnit[];
  teachers: GroupTeacher[];
  staff: TeachingStaff;
  studentCount: number;
  locale: string;
  onEditSession: (sessionId: string) => void;
};

function LogBody({
  rows,
  next,
  units,
  teachers,
  staff,
  studentCount,
  locale,
  onEditSession,
}: BodyProps) {
  const t = useTranslations('Groups');
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, PAGE);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <CalendarDays className="size-5 text-(--ssz-text-muted)" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-medium text-(--ssz-text-primary)">
            {t('schedule.logEmptyTitle')}
          </p>
          <p className="mt-0.5 text-sm text-(--ssz-text-muted)">{t('schedule.logEmptyBody')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ul>
        {visible.map((session) => (
          <LogRow
            key={session.id}
            session={session}
            state={stateOf(session, staff, next)}
            topic={topicOf(session, units)}
            teacher={teachers.find((x) => x.userId === session.teacherId) ?? null}
            studentCount={studentCount}
            locale={locale}
            onEdit={onEditSession}
          />
        ))}
      </ul>

      {rows.length > PAGE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full border-t border-border px-5 py-2.5 text-xs font-medium text-primary-600 transition-colors hover:bg-(--ssz-bg-subtle)"
        >
          {showAll ? t('schedule.showLess') : t('schedule.showAll', { n: rows.length })}
        </button>
      )}
    </>
  );
}

type RowProps = {
  session: Session;
  state: SessionState;
  topic: ReturnType<typeof topicOf>;
  teacher: GroupTeacher | null;
  studentCount: number;
  locale: string;
  onEdit: (sessionId: string) => void;
};

function LogRow({ session, state, topic, teacher, studentCount, locale, onEdit }: RowProps) {
  const t = useTranslations('Groups');
  const kind = topic?.kind ? KIND_LABEL[topic.kind] : undefined;
  const isExam = session.type === 'exam';
  const marks = isExam ? examStats(session.scores, 60) : null;

  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => onEdit(session.id)}
        className={cn(
          'group flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-left transition-colors hover:bg-(--ssz-bg-subtle)',
          // The stripe is drawn on every row, transparent where there is no
          // exam, so a row's text does not shift when one appears above it.
          'border-l-[3px]',
          isExam ? 'border-l-error-500' : 'border-l-transparent',
        )}
      >
        <span className="w-[74px] shrink-0">
          <span className="block text-[13px] font-semibold tabular-nums text-(--ssz-text-primary)">
            {dayMonth(session.date, locale)}
          </span>
          <span className="block text-[11px] text-(--ssz-text-muted)">
            {weekdayShort(session.date, locale)} {session.start}
          </span>
        </span>

        {/* Without min-w-0 the fixed columns squeeze the topic to nothing and
            the row triples in height. */}
        <span className="min-w-0 flex-[1_1_150px]">
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'truncate text-[13.5px] font-medium',
                topic ? 'text-(--ssz-text-primary)' : 'text-warning-700 dark:text-warning-400',
                session.status === 'cancelled' && 'line-through',
              )}
            >
              {topic?.itemTitle ?? topic?.unitTitle ?? t('schedule.noTopic')}
            </span>
            {session.extra && <Badge variant="muted">{t('schedule.extra')}</Badge>}
          </span>
          <span className="block truncate text-[11.5px] text-(--ssz-text-muted)">
            {[
              topic ? t('schedule.unitLabelled', { n: topic.unitOrder, title: topic.unitTitle }) : null,
              session.note,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>

        <span className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
        <span className="shrink-0">
          {isExam ? (
            <Badge variant="error">{t('schedule.exam')}</Badge>
          ) : kind ? (
            <Badge variant={kind.tone}>{t(`schedule.kind.${kind.key}`)}</Badge>
          ) : null}
        </span>

        <span className="flex w-[132px] min-w-[90px] shrink-0 items-center gap-1.5">
          {teacher ? (
            <>
              <Avatar name={teacher.name} src={teacher.avatarUrl ?? undefined} size="sm" />
              <span className="truncate text-xs text-(--ssz-text-secondary)">{teacher.name}</span>
            </>
          ) : (
            <span className="text-xs text-error-600">{t('schedule.unassigned')}</span>
          )}
        </span>

        <span className="min-w-[50px] shrink-0 text-right text-xs tabular-nums text-(--ssz-text-secondary)">
          <Metric
            session={session}
            marks={marks}
            studentCount={studentCount}
            noResults={t('schedule.noResults')}
            average={(n: number) => t('schedule.avgPct', { n })}
          />
        </span>

        <span className="flex shrink-0 items-center gap-2">
          <Badge variant={STATE_TONE[state]}>{t(`schedule.state.${state}`)}</Badge>
          <Pencil
            className="size-3.5 text-(--ssz-text-muted) opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </span>
        </span>
      </button>
    </li>
  );
}

/**
 * The one number a row is worth reading for: turnout for a lesson, the average
 * mark for an exam, and nothing at all for a session that has not happened —
 * a dash rather than a zero, which would read as "nobody came".
 */
function Metric({
  session,
  marks,
  studentCount,
  noResults,
  average,
}: {
  session: Session;
  marks: ReturnType<typeof examStats> | null;
  studentCount: number;
  noResults: string;
  average: (n: number) => string;
}) {
  // An exam speaks through its marks. They are worth showing the moment they
  // exist — an exam sat but not yet recorded as held still has a result, and
  // hiding it behind the status would make the log say less than the school
  // knows.
  if (marks) {
    if (marks.average === null) {
      return session.status === 'held' ? (
        <span className="text-(--ssz-text-muted)">{noResults}</span>
      ) : (
        <>—</>
      );
    }
    const tone = gradeTone(marks.average);
    return (
      <Badge variant={tone === 'warn' ? 'warning' : tone === 'danger' ? 'error' : tone}>
        {average(marks.average)}
      </Badge>
    );
  }

  // A lesson speaks through its turnout, and only once it has happened: a dash
  // rather than a zero, which would read as "nobody came".
  if (session.status !== 'held' || session.attendance === null) return <>—</>;
  return (
    <>
      {session.attendance}/{studentCount}
    </>
  );
}
