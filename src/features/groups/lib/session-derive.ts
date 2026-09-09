import type { OutlineUnit, Session, SessionScore } from '../types';

/**
 * Everything the schedule-and-log tab shows is derived from the list of sessions.
 * No counter is stored anywhere: the moment one were, the Materials tab and this
 * one would start disagreeing about the same group.
 */

/** How a session reads in the log and on the timeline. `next` and `sub` are derived, never stored. */
export type SessionState = 'held' | 'sub' | 'cancelled' | 'next' | 'planned';

const MS_PER_WEEK = 7 * 86_400_000;

/** Teachers a session can be taught by without it counting as cover. */
export interface TeachingStaff {
  primaryId: string | null;
  coPrimaryId: string | null;
}

function toUtcDay(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0));
}

/** Chronological order, and stable when two sessions share a day. */
export function byDate(a: Session, b: Session): number {
  return a.date.localeCompare(b.date) || a.start.localeCompare(b.start);
}

/**
 * The next session is the first one still planned — by date, not by plan
 * position, so a session moved later stops being next.
 */
export function nextSession(sessions: Session[]): Session | null {
  return (
    [...sessions].filter((s) => s.status === 'scheduled' || s.status === 'moved').sort(byDate)[0] ??
    null
  );
}

/**
 * A session was covered when somebody other than the group's own teachers taught
 * it. Only a session that happened can have been covered: a future one merely
 * has a teacher pencilled in.
 */
export function isSubstitute(session: Session, staff: TeachingStaff): boolean {
  if (session.status !== 'held' || !session.teacherId) return false;
  return session.teacherId !== staff.primaryId && session.teacherId !== staff.coPrimaryId;
}

export function stateOf(
  session: Session,
  staff: TeachingStaff,
  next: Session | null,
): SessionState {
  if (session.status === 'cancelled') return 'cancelled';
  if (session.status === 'held') return isSubstitute(session, staff) ? 'sub' : 'held';
  if (next && session.id === next.id) return 'next';
  return 'planned';
}

/**
 * Which week of the course a session falls in, counted from the first session's
 * actual date. Counting from actual dates rather than plan positions is what
 * makes a rescheduled session move on the timeline.
 */
export function weekOf(session: Session, firstDate: string): number {
  const diff = toUtcDay(session.date) - toUtcDay(firstDate);
  return Math.floor(diff / MS_PER_WEEK) + 1;
}

export interface WeeklyRhythm {
  /** Sessions a week the pattern calls for. */
  perWeek: number;
  /** Contact hours a week, from the slot lengths. */
  weeklyHours: number;
}

export function weeklyRhythm(slots: Array<{ start: string; end: string }>): WeeklyRhythm {
  const minutes = slots.reduce((sum, s) => sum + durationMinutes(s.start, s.end), 0);
  return { perWeek: slots.length, weeklyHours: Math.round((minutes / 60) * 10) / 10 };
}

export interface CourseSpan {
  firstDate: string | null;
  lastDate: string | null;
  /** The week the last held session falls in — where the group actually is. */
  currentWeek: number;
  /** The week the last planned session falls in. */
  totalWeeks: number;
  done: number;
  total: number;
  /** Share of the course delivered, 0..100. */
  pct: number;
}

export function courseSpan(sessions: Session[]): CourseSpan {
  const ordered = [...sessions].sort(byDate);
  const first = ordered[0] ?? null;
  const last = ordered.at(-1) ?? null;
  const held = ordered.filter((s) => s.status === 'held');
  const lastHeld = held.at(-1) ?? null;

  return {
    firstDate: first?.date ?? null,
    lastDate: last?.date ?? null,
    currentWeek: first && lastHeld ? weekOf(lastHeld, first.date) : 0,
    totalWeeks: first && last ? weekOf(last, first.date) : 0,
    done: held.length,
    total: ordered.length,
    pct: ordered.length ? Math.round((held.length / ordered.length) * 100) : 0,
  };
}

export interface DeliveryStats {
  held: number;
  substituted: number;
  cancelled: number;
  /** Average turnout across held non-exams, rounded; null when nothing is recorded. */
  averageAttendance: number | null;
  /** Sessions that need a topic — future ones excluded, they are simply not planned yet. */
  withoutTopic: number;
}

export function deliveryStats(
  sessions: Session[],
  staff: TeachingStaff,
  today = new Date().toISOString().slice(0, 10),
): DeliveryStats {
  const held = sessions.filter((s) => s.status === 'held');
  // Exams stay out of the attendance average: turnout is not recorded for them,
  // and counting them as zero would drag the number down for no reason.
  const recorded = held.filter((s) => s.type !== 'exam' && s.attendance !== null);

  return {
    held: held.length,
    substituted: held.filter((s) => isSubstitute(s, staff)).length,
    cancelled: sessions.filter((s) => s.status === 'cancelled').length,
    averageAttendance: recorded.length
      ? Math.round(recorded.reduce((sum, s) => sum + (s.attendance ?? 0), 0) / recorded.length)
      : null,
    withoutTopic: sessions.filter(
      (s) => !s.contentLessonId && !s.contentUnitId && s.status !== 'cancelled' && s.date <= today,
    ).length,
  };
}

export interface ExamStats {
  /** Average of the marks entered; null when none are. */
  average: number | null;
  graded: number;
  passed: number;
}

export function examStats(scores: SessionScore[], passMark: number): ExamStats {
  const graded = scores.filter((s) => s.score !== null);
  if (!graded.length) return { average: null, graded: 0, passed: 0 };

  const total = graded.reduce((sum, s) => sum + (s.score ?? 0), 0);
  return {
    average: Math.round(total / graded.length),
    graded: graded.length,
    passed: graded.filter((s) => (s.score ?? 0) >= passMark).length,
  };
}

/** One shared scale for badges, bars and the log's metric column. */
export type GradeTone = 'success' | 'primary' | 'warn' | 'danger';

export function gradeTone(score: number): GradeTone {
  if (score >= 85) return 'success';
  if (score >= 60) return 'primary';
  if (score >= 45) return 'warn';
  return 'danger';
}

export interface TeacherShare {
  teacherId: string;
  delivered: number;
  /** Share of held sessions, 0..100. */
  pct: number;
  /** Cover and co-teaching read differently from the group's own teacher. */
  isPrimary: boolean;
}

export function whoTaught(sessions: Session[], staff: TeachingStaff): TeacherShare[] {
  const held = sessions.filter((s) => s.status === 'held' && s.teacherId);
  const counts = new Map<string, number>();
  for (const session of held) {
    counts.set(session.teacherId!, (counts.get(session.teacherId!) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([teacherId, delivered]) => ({
      teacherId,
      delivered,
      pct: held.length ? Math.round((delivered / held.length) * 100) : 0,
      isPrimary: teacherId === staff.primaryId,
    }))
    .sort((a, b) => b.delivered - a.delivered);
}

export interface UnitCoverage {
  contentUnitId: string;
  taught: number;
  planned: number;
  state: 'done' | 'in-progress' | 'untouched';
}

/**
 * How much of each course unit the group has actually been through. Counted from
 * session statuses, never from a stored counter — a cancelled session leaves its
 * topic untaught, and only what was held counts as taught.
 */
export function coverageByUnit(sessions: Session[]): UnitCoverage[] {
  const byUnit = new Map<string, { taught: number; planned: number }>();

  for (const session of sessions) {
    if (!session.contentUnitId) continue;
    const entry = byUnit.get(session.contentUnitId) ?? { taught: 0, planned: 0 };
    entry.planned += 1;
    if (session.status === 'held') entry.taught += 1;
    byUnit.set(session.contentUnitId, entry);
  }

  return [...byUnit.entries()].map(([contentUnitId, { taught, planned }]) => ({
    contentUnitId,
    taught,
    planned,
    state: taught === 0 ? 'untouched' : taught >= planned ? 'done' : 'in-progress',
  }));
}

export type LogFilter = 'recent' | 'issues' | 'exams' | 'upcoming';

/**
 * The log's four views. `recent` and `issues` read newest first — the useful end
 * of a record of the past; `exams` and `upcoming` read forwards, because they are
 * about what is coming.
 */
export function filterLog(
  sessions: Session[],
  filter: LogFilter,
  staff: TeachingStaff,
  today = new Date().toISOString().slice(0, 10),
): Session[] {
  const next = nextSession(sessions);
  const newestFirst = (a: Session, b: Session) => byDate(b, a);

  switch (filter) {
    case 'recent':
      return sessions
        .filter((s) => s.status === 'held' || s.status === 'cancelled' || s.date <= today)
        .sort(newestFirst);

    case 'issues':
      return sessions
        .filter(
          (s) =>
            s.status === 'cancelled' ||
            isSubstitute(s, staff) ||
            // A missing topic only counts against a session that has come round.
            (!s.contentUnitId && !s.contentLessonId && s.date <= today) ||
            // An exam that happened and still has no marks is unfinished work.
            (s.type === 'exam' && s.status === 'held' && !s.scores.some((x) => x.score !== null)),
        )
        .sort(newestFirst);

    case 'exams':
      return sessions.filter((s) => s.type === 'exam').sort(byDate);

    case 'upcoming':
      return sessions
        .filter((s) => s.status === 'scheduled' || s.status === 'moved')
        .sort(byDate)
        .sort((a, b) => (a.id === next?.id ? -1 : b.id === next?.id ? 1 : 0));
  }
}

export interface TimelineCell {
  session: Session;
  state: SessionState;
}

export interface TimelineWeek {
  /** Week number of the course, counted from the first session's date. */
  week: number;
  cells: TimelineCell[];
}

/**
 * The course as a strip of weeks. A week with no session still gets a column —
 * a fortnight's gap in the middle of a course is a fact about the course, and
 * squeezing it out would make the strip lie about the rhythm.
 */
export function timelineWeeks(sessions: Session[], staff: TeachingStaff): TimelineWeek[] {
  const ordered = [...sessions].sort(byDate);
  const first = ordered[0];
  if (!first) return [];

  const next = nextSession(sessions);
  const weeks = new Map<number, TimelineCell[]>();
  let last = 1;

  for (const session of ordered) {
    const week = weekOf(session, first.date);
    last = Math.max(last, week);
    const cells = weeks.get(week) ?? [];
    cells.push({ session, state: stateOf(session, staff, next) });
    weeks.set(week, cells);
  }

  return Array.from({ length: last }, (_, i) => ({
    week: i + 1,
    cells: weeks.get(i + 1) ?? [],
  }));
}

/** What a session teaches, as the tab names it. */
export interface SessionTopic {
  unitOrder: number;
  unitTitle: string;
  /** The item's own title; null when the session is pinned to a unit as a whole. */
  itemTitle: string | null;
  /** Material kind of the item, for the log's badge. */
  kind: string | null;
}

/**
 * Names a session's topic from the course outline. A session may point at an
 * item, at a unit as a whole (a checkpoint, or a unit with nothing but
 * exercises in it), or at nothing at all — the last is a legal state, not an
 * error: nobody has planned that session yet.
 */
export function topicOf(session: Session, units: OutlineUnit[]): SessionTopic | null {
  const unit =
    units.find((u) => u.id === session.contentUnitId) ??
    (session.contentLessonId
      ? units.find((u) => u.items.some((i) => i.id === session.contentLessonId))
      : undefined);
  if (!unit) return null;

  const item = session.contentLessonId
    ? (unit.items.find((i) => i.id === session.contentLessonId) ?? null)
    : null;

  return {
    unitOrder: unit.order,
    unitTitle: unit.title,
    itemTitle: item?.title ?? null,
    kind: item?.kind ?? item?.itemType ?? null,
  };
}
