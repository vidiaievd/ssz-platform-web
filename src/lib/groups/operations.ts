/**
 * Single source of truth for group / teacher operations math.
 * Used by: groups list, group detail, timetable, dashboard widgets.
 * Dashboard re-exports everything from here — do not duplicate.
 */

import type { ISODate } from '@/features/groups/types';

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type HHMM = string; // "HH:MM"

export type Slot = {
  day: Weekday;
  start: HHMM;
  end: HHMM;
  room: string;
};

export type GroupForOps = {
  id: string;
  status: 'draft' | 'active' | 'archived';
  primaryTeacherId: string | null;
  coPrimaryTeacherId: string | null;
  slots: Slot[];
  studentCount: number;
  capacity: { min: number; max: number };
};

export type TeacherForOps = {
  id: string;
  maxWeeklyHours: number;
};

export type AlertType = 'no-primary' | 'conflict' | 'overload' | 'over' | 'under';
export type AlertSeverity = 'danger' | 'warn';

export type OpAlert = {
  type: AlertType;
  severity: AlertSeverity;
  label: string;
};

export type TeacherLoadResult = {
  hours: number;
  max: number;
  pct: number;
  overloaded: boolean;
  groups: number;
  conflicts: number;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function slotsOverlap(a: Slot, b: Slot): boolean {
  if (a.day !== b.day) return false;
  const aStart = timeToMinutes(a.start);
  const aEnd = timeToMinutes(a.end);
  const bStart = timeToMinutes(b.start);
  const bEnd = timeToMinutes(b.end);
  return aStart < bEnd && bStart < aEnd;
}

function groupHasConflictForTeacher(
  teacherId: string,
  group: GroupForOps,
  otherGroups: GroupForOps[],
): boolean {
  const isAssigned =
    group.primaryTeacherId === teacherId || group.coPrimaryTeacherId === teacherId;
  if (!isAssigned) return false;

  for (const other of otherGroups) {
    if (other.id === group.id) continue;
    const otherAssigned =
      other.primaryTeacherId === teacherId || other.coPrimaryTeacherId === teacherId;
    if (!otherAssigned) continue;
    for (const slotA of group.slots) {
      for (const slotB of other.slots) {
        if (slotsOverlap(slotA, slotB)) return true;
      }
    }
  }
  return false;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns ordered alerts for a single group.
 * `no-primary` + `conflict` are danger; `overload`, `over`, `under` are warn.
 */
export function groupAlerts(
  group: GroupForOps,
  teacherMaxHours: number | null,
  activeGroups: GroupForOps[],
): OpAlert[] {
  const alerts: OpAlert[] = [];

  if (!group.primaryTeacherId) {
    alerts.push({ type: 'no-primary', severity: 'danger', label: 'No primary teacher assigned' });
  } else {
    const hasConflict = groupHasConflictForTeacher(
      group.primaryTeacherId,
      group,
      activeGroups,
    );
    if (hasConflict) {
      alerts.push({ type: 'conflict', severity: 'danger', label: 'Teacher has an overlapping lesson' });
    }
    if (teacherMaxHours !== null) {
      const weeklyHours = group.slots.reduce((acc, s) => {
        const dur = (timeToMinutes(s.end) - timeToMinutes(s.start)) / 60;
        return acc + dur;
      }, 0);
      if (weeklyHours > teacherMaxHours) {
        alerts.push({ type: 'overload', severity: 'warn', label: `Over by ${(weeklyHours - teacherMaxHours).toFixed(1)}h` });
      }
    }
  }

  if (group.studentCount > group.capacity.max) {
    alerts.push({ type: 'over', severity: 'warn', label: `${group.studentCount}/${group.capacity.max} — over capacity` });
  } else if (group.studentCount < group.capacity.min) {
    alerts.push({ type: 'under', severity: 'warn', label: `${group.studentCount}/${group.capacity.min} — under minimum` });
  }

  return alerts;
}

/**
 * Number of conflict pairs for a teacher across active groups (O(groups² × slots²)).
 */
export function teacherConflicts(teacherId: string, activeGroups: GroupForOps[]): number {
  const teacherGroups = activeGroups.filter(
    (g) => g.primaryTeacherId === teacherId || g.coPrimaryTeacherId === teacherId,
  );

  let count = 0;
  for (let i = 0; i < teacherGroups.length; i++) {
    for (let j = i + 1; j < teacherGroups.length; j++) {
      outer: for (const slotA of teacherGroups[i]!.slots) {
        for (const slotB of teacherGroups[j]!.slots) {
          if (slotsOverlap(slotA, slotB)) {
            count++;
            break outer;
          }
        }
      }
    }
  }
  return count;
}

/**
 * Total conflict pairs across all teachers (used by "Scheduling conflicts" KPI).
 */
export function schoolConflictCount(
  activeGroups: GroupForOps[],
  teacherIds: string[],
): number {
  return teacherIds.reduce((acc, tid) => acc + teacherConflicts(tid, activeGroups), 0);
}

/**
 * Weekly load summary for a single teacher.
 */
export function teacherLoad(
  teacher: TeacherForOps,
  activeGroups: GroupForOps[],
): TeacherLoadResult {
  const myGroups = activeGroups.filter(
    (g) => g.primaryTeacherId === teacher.id || g.coPrimaryTeacherId === teacher.id,
  );

  const hours = myGroups.reduce((acc, g) => {
    return (
      acc +
      g.slots.reduce((s, slot) => {
        return s + (timeToMinutes(slot.end) - timeToMinutes(slot.start)) / 60;
      }, 0)
    );
  }, 0);

  const pct = teacher.maxWeeklyHours > 0
    ? Math.round((hours / teacher.maxWeeklyHours) * 100)
    : 0;

  return {
    hours,
    max: teacher.maxWeeklyHours,
    pct,
    overloaded: hours > teacher.maxWeeklyHours,
    groups: myGroups.length,
    conflicts: teacherConflicts(teacher.id, activeGroups),
  };
}

/**
 * Projected student count after adding `addCount` students.
 * Returns whether the result is within, over, or under capacity.
 */
export function projectedCapacity(
  group: GroupForOps,
  addCount: number,
): { projected: number; over: boolean; under: boolean; withinCapacity: boolean } {
  const projected = group.studentCount + addCount;
  return {
    projected,
    over: projected > group.capacity.max,
    under: projected < group.capacity.min,
    withinCapacity: projected >= group.capacity.min && projected <= group.capacity.max,
  };
}

const WEEKDAY_ORDER: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Generates the next `n` lesson dates from `slots`, starting at or after `from`.
 * Respects term boundaries: if `group` has `startDate`/`endDate` those are used.
 * Deterministic — no randomness.
 */
export function nextLessons(
  group: { id: string; slots: Slot[]; startDate: ISODate | null; endDate: ISODate | null },
  from: ISODate,
  n: number,
): Array<{ date: ISODate; slot: Slot }> {
  if (!group.slots.length || n <= 0) return [];

  const termEnd = group.endDate ? new Date(group.endDate) : null;
  const fromDate = new Date(from);
  const results: Array<{ date: ISODate; slot: Slot }> = [];

  // Walk up to 365 days from `from` collecting slot occurrences
  for (let offset = 0; offset < 365 && results.length < n; offset++) {
    const d = addDays(fromDate, offset);
    if (termEnd && d > termEnd) break;
    const dayName = WEEKDAY_ORDER[d.getDay() === 0 ? 6 : d.getDay() - 1]!;
    const daySlots = group.slots.filter((s) => s.day === dayName);
    for (const slot of daySlots) {
      if (results.length >= n) break;
      results.push({ date: toISODate(d), slot });
    }
  }

  return results;
}
