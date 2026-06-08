/**
 * Single source of truth for group / teacher operations math.
 * Used by: groups list, group detail, timetable, dashboard widgets,
 *          teacher management (workload/substitution/forecast).
 * Dashboard re-exports everything from here — do not duplicate.
 */

import type { ISODate, LangCode } from '@/features/groups/types';
import type {
  AvailabilityBlock,
  SubstituteCandidate,
  CandidateClass,
  ForecastParams,
  ForecastResult,
  ForecastBaseline,
  HealthState,
} from '@/features/teachers/types';

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

// ── Workload policy constants (spec Appendix B) ───────────────────────────────

export const WORKLOAD_POLICY = {
  PREP_FACTOR: 0.30,
  PREP_PER_COURSE: 1.0,
  DAILY_CONTACT_CAP: 6,
  MAX_CONSECUTIVE: 4,
  NEAR_CAP_RATIO: 0.85,
  GAP_PENALTY_PER_H: 0.25,
  CONSEC_PENALTY: 0.50,
  HOURS_PER_GROUP_DEFAULT: 2.5,
  CONTRACT_PER_TEACHER_DEFAULT: 8,
  SUB_SCORE_WEIGHTS: { capacity: 40, familiarity: 25, noOverload: 20, availability: 15 },
} as const;

export type WorkloadPolicy = typeof WORKLOAD_POLICY;

// ── §5 Effective load formulas ────────────────────────────────────────────────

/** Preparation hours from contact hours and number of distinct courses taught. */
export function prepHours(
  contact: number,
  distinctCourses: number,
  policy: Pick<WorkloadPolicy, 'PREP_FACTOR' | 'PREP_PER_COURSE'> = WORKLOAD_POLICY,
): number {
  return contact * policy.PREP_FACTOR + policy.PREP_PER_COURSE * distinctCourses;
}

/** Total effective load = contact + prep. */
export function effectiveLoad(contact: number, prep: number): number {
  return contact + prep;
}

/** Peak contact hours on any single day across a set of slots. */
export function dayPeak(slots: Slot[]): number {
  const byDay: Record<string, number> = {};
  for (const s of slots) {
    const dur = (timeToMinutes(s.end) - timeToMinutes(s.start)) / 60;
    byDay[s.day] = (byDay[s.day] ?? 0) + dur;
  }
  return Math.max(0, ...Object.values(byDay));
}

/** Longest back-to-back consecutive run in hours across a set of slots. */
export function consecPeak(slots: Slot[]): number {
  if (!slots.length) return 0;

  const byDay: Record<string, Slot[]> = {};
  for (const s of slots) {
    if (!byDay[s.day]) byDay[s.day] = [];
    byDay[s.day]!.push(s);
  }

  let maxRun = 0;
  for (const day of Object.values(byDay)) {
    const sorted = [...day].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    let runStart = timeToMinutes(sorted[0]!.start);
    let runEnd = timeToMinutes(sorted[0]!.end);
    for (let i = 1; i < sorted.length; i++) {
      const s = sorted[i]!;
      if (timeToMinutes(s.start) <= runEnd) {
        runEnd = Math.max(runEnd, timeToMinutes(s.end));
      } else {
        maxRun = Math.max(maxRun, (runEnd - runStart) / 60);
        runStart = timeToMinutes(s.start);
        runEnd = timeToMinutes(s.end);
      }
    }
    maxRun = Math.max(maxRun, (runEnd - runStart) / 60);
  }
  return maxRun;
}

/** Soft scheduling cost: gap penalties + consecutive-overrun penalty. */
export function softCost(
  slots: Slot[],
  policy: Pick<WorkloadPolicy, 'GAP_PENALTY_PER_H' | 'CONSEC_PENALTY' | 'MAX_CONSECUTIVE'> = WORKLOAD_POLICY,
): number {
  const byDay: Record<string, Slot[]> = {};
  for (const s of slots) {
    if (!byDay[s.day]) byDay[s.day] = [];
    byDay[s.day]!.push(s);
  }

  let cost = 0;

  for (const day of Object.values(byDay)) {
    const sorted = [...day].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      const gap = (timeToMinutes(curr.start) - timeToMinutes(prev.end)) / 60;
      if (gap > 0) cost += policy.GAP_PENALTY_PER_H * gap;
    }
  }

  const cp = consecPeak(slots);
  cost += policy.CONSEC_PENALTY * Math.max(0, cp - policy.MAX_CONSECUTIVE);
  return cost;
}

/**
 * Health classification (spec §5).
 * danger: over cap OR conflictCount > 0 OR dayPeak > DAILY_CONTACT_CAP OR consec > MAX_CONSECUTIVE+1
 * warn:   utilization ≥ NEAR_CAP_RATIO OR dayPeak > MAX_CONSECUTIVE OR consec > MAX_CONSECUTIVE
 * ok:     otherwise
 */
export function healthState(
  contact: number,
  cap: number,
  conflictCount: number,
  dp: number,
  cp: number,
  policy: Pick<WorkloadPolicy, 'NEAR_CAP_RATIO' | 'DAILY_CONTACT_CAP' | 'MAX_CONSECUTIVE'> = WORKLOAD_POLICY,
): HealthState {
  if (
    contact > cap ||
    conflictCount > 0 ||
    dp > policy.DAILY_CONTACT_CAP ||
    cp > policy.MAX_CONSECUTIVE + 1
  ) {
    return 'danger';
  }
  if (
    cap > 0 && contact / cap >= policy.NEAR_CAP_RATIO ||
    dp > policy.MAX_CONSECUTIVE ||
    cp > policy.MAX_CONSECUTIVE
  ) {
    return 'warn';
  }
  return 'ok';
}

// ── §6 Scheduling validation helpers ─────────────────────────────────────────

export type ConflictType =
  | 'overlap'
  | 'room_double_book'
  | 'availability'
  | 'language'
  | 'cap_exceeded'
  | 'sub_loop';

export type SlotForValidation = { day: Weekday; start: HHMM; end: HHMM; room?: string };

/** True when `slot` is fully contained within at least one `available`/`preferred` block. */
export function withinAvailability(slot: SlotForValidation, blocks: AvailabilityBlock[]): boolean {
  const slotStart = timeToMinutes(slot.start);
  const slotEnd = timeToMinutes(slot.end);
  return blocks.some(
    (b) =>
      b.dayOfWeek === slot.day &&
      b.type !== 'unavailable' &&
      timeToMinutes(b.startTime) <= slotStart &&
      timeToMinutes(b.endTime) >= slotEnd,
  );
}

/** True when the teacher can instruct in the group's language. */
export function teacherSpeaks(teacherLangs: LangCode[], groupLang: LangCode): boolean {
  return teacherLangs.includes(groupLang);
}

export type AssignmentContext = {
  candidateLangs: LangCode[];
  groupLang: LangCode;
  candidateSlots: Slot[];
  newSlot: SlotForValidation;
  availabilityBlocks: AvailabilityBlock[];
  contactHoursAfter: number;
  cap: number;
  isSubLoop?: boolean;
};

export function validateAssignment(
  ctx: AssignmentContext,
): { ok: true } | { ok: false; conflictType: ConflictType } {
  if (!teacherSpeaks(ctx.candidateLangs, ctx.groupLang)) {
    return { ok: false, conflictType: 'language' };
  }
  for (const existing of ctx.candidateSlots) {
    if (slotsOverlap(existing, ctx.newSlot as Slot)) {
      return { ok: false, conflictType: 'overlap' };
    }
  }
  if (ctx.availabilityBlocks.length > 0 && !withinAvailability(ctx.newSlot, ctx.availabilityBlocks)) {
    return { ok: false, conflictType: 'availability' };
  }
  if (ctx.contactHoursAfter > ctx.cap) {
    return { ok: false, conflictType: 'cap_exceeded' };
  }
  if (ctx.isSubLoop) {
    return { ok: false, conflictType: 'sub_loop' };
  }
  return { ok: true };
}

// ── §7 Candidate scoring ──────────────────────────────────────────────────────

export type CandidateInput = {
  teacherId: string;
  name: string;
  avatarUrl?: string | null;
  langs: LangCode[];
  currentContactHours: number;
  maxWeeklyContactHours: number;
  isFreeAtSlot: boolean;
  isFamiliar: boolean;
  isSubLoop?: boolean;
};

export type LessonForScoring = {
  lang: LangCode;
  durationHours: number;
};

export function scoreCandidate(
  c: CandidateInput,
  lesson: LessonForScoring,
  policy: Pick<WorkloadPolicy, 'SUB_SCORE_WEIGHTS'> = WORKLOAD_POLICY,
): SubstituteCandidate {
  const { SUB_SCORE_WEIGHTS: W } = policy;

  const canLang = teacherSpeaks(c.langs, lesson.lang);
  const free = c.isFreeAtSlot;

  // Hard gates
  if (!canLang || !free) {
    return {
      teacherId: c.teacherId,
      name: c.name,
      avatarUrl: c.avatarUrl,
      eligible: false,
      fitScore: 0,
      classification: 'ineligible',
      factors: {
        canLang,
        free,
        spareRatio: 0,
        familiar: c.isFamiliar,
        wouldOverload: false,
        subLoop: c.isSubLoop,
      },
    };
  }

  const wouldOverload =
    c.maxWeeklyContactHours > 0
      ? c.currentContactHours + lesson.durationHours > c.maxWeeklyContactHours
      : false;

  const spareRatio =
    c.maxWeeklyContactHours > 0
      ? Math.max(0, (c.maxWeeklyContactHours - c.currentContactHours) / c.maxWeeklyContactHours)
      : 1;

  const capScore = Math.round(spareRatio * W.capacity);
  const famScore = c.isFamiliar ? W.familiarity : canLang ? 10 : 0;
  const disrScore = wouldOverload ? 0 : W.noOverload;
  const availScore = free ? W.availability : 0;

  const fitScore = Math.min(100, capScore + famScore + disrScore + availScore);

  let classification: CandidateClass;
  if (fitScore >= 80) classification = 'best';
  else if (fitScore >= 55) classification = 'good';
  else classification = 'ok';

  return {
    teacherId: c.teacherId,
    name: c.name,
    avatarUrl: c.avatarUrl,
    eligible: true,
    fitScore,
    classification,
    factors: { canLang, free, spareRatio, familiar: c.isFamiliar, wouldOverload, subLoop: c.isSubLoop },
  };
}

/** Rank a pool of candidates for a lesson (spec §7.2). */
export function rankCandidates(
  pool: CandidateInput[],
  lesson: LessonForScoring,
  policy: Pick<WorkloadPolicy, 'SUB_SCORE_WEIGHTS'> = WORKLOAD_POLICY,
): SubstituteCandidate[] {
  const scored = pool.map((c) => scoreCandidate(c, lesson, policy));
  return scored.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.fitScore !== b.fitScore) return b.fitScore - a.fitScore;
    if (a.factors.spareRatio !== b.factors.spareRatio)
      return b.factors.spareRatio - a.factors.spareRatio;
    return a.teacherId < b.teacherId ? -1 : 1;
  });
}

// ── §10 Forecast ──────────────────────────────────────────────────────────────

export function forecast(params: ForecastParams, baseline: ForecastBaseline): ForecastResult {
  const { growth, terms, groupSize, hoursPerGroup, contractPerTeacher } = params;

  const projection: ForecastResult['projection'] = [];
  for (let t = 1; t <= terms; t++) {
    const students = Math.round(baseline.studentCount * Math.pow(1 + growth, t));
    const groupsNeeded = Math.ceil(students / groupSize);
    const contactHours = groupsNeeded * hoursPerGroup;
    const teachersNeeded = Math.ceil(contactHours / contractPerTeacher);
    projection.push({ term: t, teachersNeeded, contactHours });
  }

  const lastTerm = projection[projection.length - 1];
  const totalNeeded = lastTerm?.teachersNeeded ?? 0;

  const perLanguage: ForecastResult['perLanguage'] = baseline.perLanguage.map((lang) => {
    const langShareRatio =
      baseline.studentCount > 0 ? lang.studentCount / baseline.studentCount : 0;
    const langTeachersNeeded = Math.ceil(totalNeeded * langShareRatio);
    const utilProjected =
      lang.teacherCount > 0 ? langTeachersNeeded / lang.teacherCount : Infinity;

    let risk: 'low' | 'medium' | 'high';
    if (utilProjected >= 1.0) risk = 'high';
    else if (utilProjected >= 0.85) risk = 'medium';
    else risk = 'low';

    return {
      lang: lang.lang,
      teachersNeeded: langTeachersNeeded,
      teachersHaving: lang.teacherCount,
      gap: Math.max(0, langTeachersNeeded - lang.teacherCount),
      utilProjected,
      risk,
    };
  });

  const bottleneck =
    perLanguage.length > 0
      ? perLanguage.reduce((max, l) =>
          l.utilProjected > max.utilProjected ? l : max,
        )
      : null;

  return {
    projection,
    perLanguage,
    bottleneck: bottleneck
      ? { lang: bottleneck.lang, utilProjected: bottleneck.utilProjected }
      : null,
    hireGap: Math.max(0, totalNeeded - baseline.activeTeacherCount),
  };
}
