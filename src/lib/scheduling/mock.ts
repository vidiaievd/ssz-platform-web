/**
 * Deterministic mock scheduling provider.
 * All data comes from fixtures.ts — no randomness, no network calls.
 * Switch to real.ts via SCHEDULING_BACKEND=real env flag.
 */

import type { Slot, Lesson, TimetableTeacher, OpsWarning } from '@/features/groups/types';
import type { SchedulingProvider, CommandCenterData, MutationResult } from './provider';
import type {
  AvailabilityBlock,
  Absence,
  SubstituteRequest,
  SubstituteCandidate,
  CurriculumPlan,
  ForecastParams,
  ForecastResult,
  WorkloadKpis,
  TeacherLoadRow,
  Vacancy,
  RoomLoad,
} from '@/features/teachers/types';
import {
  FIXTURE_SLOTS,
  FIXTURE_DEFAULT_SLOTS,
  FIXTURE_TEACHER_MAX_HOURS,
  FIXTURE_TEACHER_META,
  FIXTURE_SCHOOL_TEACHERS,
  FIXTURE_GROUP_META,
  FIXTURE_TEACHER_LANGS,
  FIXTURE_TEACHER_EMPLOYMENT as _FIXTURE_TEACHER_EMPLOYMENT,
  FIXTURE_AVAILABILITY,
  FIXTURE_ABSENCES,
  FIXTURE_SUB_REQUESTS,
  FIXTURE_CURRICULUM,
  FIXTURE_ALERTS,
} from './fixtures';
import {
  teacherLoad,
  teacherConflicts,
  nextLessons as computeNextLessons,
  prepHours,
  effectiveLoad,
  dayPeak,
  consecPeak,
  healthState,
  rankCandidates,
  forecast as computeForecast,
  WORKLOAD_POLICY,
  type GroupForOps,
} from '@/lib/groups/operations';

function getFixtureSlots(groupId: string): Slot[] {
  return FIXTURE_SLOTS[groupId] ?? FIXTURE_DEFAULT_SLOTS;
}

function buildGroupForOps(groupId: string): GroupForOps | null {
  const meta = FIXTURE_GROUP_META[groupId];
  if (!meta) return null;
  return {
    id: groupId,
    status: meta.status,
    primaryTeacherId: meta.primaryTeacherId,
    coPrimaryTeacherId: meta.coPrimaryTeacherId,
    slots: getFixtureSlots(groupId),
    studentCount: meta.studentCount,
    capacity: meta.capacity,
  };
}

function allActiveGroupsForOps(): GroupForOps[] {
  return Object.keys(FIXTURE_GROUP_META)
    .map(buildGroupForOps)
    .filter((g): g is GroupForOps => g !== null && g.status === 'active');
}

export const mockProvider: SchedulingProvider = {
  async getSlots(groupId: string): Promise<Slot[]> {
    return getFixtureSlots(groupId);
  },

  async putSlots(groupId: string, slots: Slot[]): Promise<void> {
    FIXTURE_SLOTS[groupId] = slots;
  },

  async nextLessons(groupId: string, limit: number): Promise<Lesson[]> {
    const meta = FIXTURE_GROUP_META[groupId];
    if (!meta) return [];

    const slots = getFixtureSlots(groupId);
    const today = new Date().toISOString().slice(0, 10);
    const occurrences = computeNextLessons(
      { id: groupId, slots, startDate: meta.startDate, endDate: meta.endDate },
      today,
      limit,
    );

    const teacherId = meta.primaryTeacherId ?? 'unknown';
    const teacherMeta = FIXTURE_TEACHER_META[teacherId];
    return occurrences.map((o, i) => ({
      id: `${groupId}-lesson-${i}`,
      groupId,
      date: o.date,
      start: o.slot.start,
      end: o.slot.end,
      teacherId,
      teacherName: teacherMeta?.name ?? 'Unknown Teacher',
      room: o.slot.room,
      isSubstitute: false,
    }));
  },

  async teacherTimetable(schoolId: string): Promise<TimetableTeacher[]> {
    const teacherIds = FIXTURE_SCHOOL_TEACHERS[schoolId] ?? [];
    const activeGroups = allActiveGroupsForOps();

    return teacherIds.map((tid) => {
      const meta = FIXTURE_TEACHER_META[tid];
      const maxHours = FIXTURE_TEACHER_MAX_HOURS[tid] ?? 20;
      const load = teacherLoad({ id: tid, maxWeeklyHours: maxHours }, activeGroups);

      const myGroups = activeGroups.filter(
        (g) => g.primaryTeacherId === tid || g.coPrimaryTeacherId === tid,
      );
      const lessons = myGroups.flatMap((g) => {
        const gMeta = FIXTURE_GROUP_META[g.id];
        return g.slots.map((s) => ({
          day: s.day as import('@/features/groups/types').Weekday,
          start: s.start,
          end: s.end,
          groupId: g.id,
          groupName: gMeta?.name ?? g.id,
          lang: gMeta?.lang ?? 'en',
          isSubstitute: false,
        }));
      });

      return {
        userId: tid,
        name: meta?.name ?? tid,
        avatarUrl: meta?.avatarUrl ?? null,
        hours: load.hours,
        max: load.max,
        pct: load.pct,
        overloaded: load.overloaded,
        groups: load.groups,
        conflicts: load.conflicts,
        lessons,
      };
    });
  },

  async teacherConflicts(schoolId: string): Promise<OpsWarning[]> {
    const teacherIds = FIXTURE_SCHOOL_TEACHERS[schoolId] ?? [];
    const activeGroups = allActiveGroupsForOps();
    const warnings: OpsWarning[] = [];

    for (const tid of teacherIds) {
      const conflictCount = teacherConflicts(tid, activeGroups);
      if (conflictCount > 0) {
        const myGroups = activeGroups.filter(
          (g) => g.primaryTeacherId === tid || g.coPrimaryTeacherId === tid,
        );
        for (let i = 0; i < myGroups.length; i++) {
          for (let j = i + 1; j < myGroups.length; j++) {
            const gA = myGroups[i]!;
            const gB = myGroups[j]!;
            const conflictSlot = gA.slots.find((sa) =>
              gB.slots.some((sb) => {
                if (sa.day !== sb.day) return false;
                const aStart = parseInt(sa.start.replace(':', ''));
                const aEnd = parseInt(sa.end.replace(':', ''));
                const bStart = parseInt(sb.start.replace(':', ''));
                const bEnd = parseInt(sb.end.replace(':', ''));
                return aStart < bEnd && bStart < aEnd;
              }),
            );
            if (conflictSlot) {
              warnings.push({
                type: 'conflict',
                with: gB.id,
                day: conflictSlot.day as import('@/features/groups/types').Weekday,
                time: conflictSlot.start,
              });
            }
          }
        }
      }
    }
    return warnings;
  },

  async studentClashes(_schoolId: string, _userId: string): Promise<OpsWarning[]> {
    return [];
  },

  // ── Teacher management ────────────────────────────────────────────────────

  async commandCenter(schoolId: string): Promise<CommandCenterData> {
    const teacherIds = FIXTURE_SCHOOL_TEACHERS[schoolId] ?? [];
    const activeGroups = allActiveGroupsForOps();

    let overloadedCount = 0;
    let clashCount = 0;
    let totalUtilPct = 0;
    let totalSpare = 0;
    const teacherRows: TeacherLoadRow[] = [];

    for (const tid of teacherIds) {
      const meta = FIXTURE_TEACHER_META[tid];
      const maxContact = FIXTURE_TEACHER_MAX_HOURS[tid] ?? 20;
      const langs = FIXTURE_TEACHER_LANGS[tid] ?? [];
      const load = teacherLoad({ id: tid, maxWeeklyHours: maxContact }, activeGroups);

      const myGroups = activeGroups.filter(
        (g) => g.primaryTeacherId === tid || g.coPrimaryTeacherId === tid,
      );
      const distinctCourses = new Set(myGroups.map((g) => FIXTURE_GROUP_META[g.id]?.lang ?? 'xx')).size;
      const prep = prepHours(load.hours, distinctCourses);
      const effective = effectiveLoad(load.hours, prep);
      const mySlots = myGroups.flatMap((g) => g.slots);
      const dp = dayPeak(mySlots);
      const cp = consecPeak(mySlots);
      const conflicts = teacherConflicts(tid, activeGroups);
      const state = healthState(load.hours, maxContact, conflicts, dp, cp);

      const utilPct = maxContact > 0 ? Math.round((load.hours / maxContact) * 100) : 0;
      totalUtilPct += utilPct;
      totalSpare += Math.max(0, maxContact - load.hours);
      if (load.overloaded) overloadedCount++;
      if (conflicts > 0) clashCount++;

      teacherRows.push({
        teacherId: tid,
        name: meta?.name ?? tid,
        avatarUrl: meta?.avatarUrl ?? null,
        languages: langs,
        contactHours: load.hours,
        prepHours: prep,
        effectiveLoad: effective,
        utilizationPct: utilPct,
        healthState: state,
        groupCount: load.groups,
        conflictCount: conflicts,
        maxWeeklyContactHours: maxContact,
      });
    }

    const vacancies: Vacancy[] = Object.entries(FIXTURE_GROUP_META)
      .filter(([, m]) => m.status === 'active' && !m.primaryTeacherId)
      .map(([gid, m]) => ({
        groupId: gid,
        groupName: m.name,
        lang: m.lang,
        kind: 'no-primary' as const,
      }));

    const roomLoad: RoomLoad[] = [];

    const kpis: WorkloadKpis = {
      utilizationAvgPct: teacherIds.length > 0 ? Math.round(totalUtilPct / teacherIds.length) : 0,
      spareCapacityHours: totalSpare,
      overloadedCount,
      clashCount,
      vacancyCount: vacancies.length,
    };

    return {
      kpis,
      teachers: teacherRows.sort((a, b) => b.utilizationPct - a.utilizationPct),
      violations: FIXTURE_ALERTS,
      vacancies,
      roomLoad,
    };
  },

  async getAvailability(teacherId: string): Promise<AvailabilityBlock[]> {
    return FIXTURE_AVAILABILITY[teacherId] ?? [];
  },

  async putAvailability(teacherId: string, blocks: AvailabilityBlock[]): Promise<void> {
    FIXTURE_AVAILABILITY[teacherId] = blocks;
  },

  async listAbsences(schoolId: string): Promise<Absence[]> {
    const teacherIds = new Set(FIXTURE_SCHOOL_TEACHERS[schoolId] ?? []);
    return FIXTURE_ABSENCES.filter((a) => teacherIds.has(a.teacherId));
  },

  async reportAbsence(input): Promise<{ absenceId: string; createdRequests: SubstituteRequest[] }> {
    const absenceId = `absence-${Date.now()}`;
    const absence: Absence = {
      absenceId,
      teacherId: input.teacherId,
      kind: input.kind,
      scope: input.scope,
      from: input.from,
      to: input.to,
      reason: input.reason,
      affectedLessonCount: 2,
      coveredCount: 0,
    };
    FIXTURE_ABSENCES.push(absence);

    const req: SubstituteRequest = {
      requestId: `req-${Date.now()}`,
      lessonId: `lesson-auto-${Date.now()}`,
      groupId: 'group-a1',
      groupName: 'English A1 Morning',
      originalTeacherId: input.teacherId,
      coverWindow: { from: input.from, to: input.to ?? input.from },
      urgency: 'upcoming',
      status: 'open',
      lang: 'en',
      day: 'Mon',
      start: '18:00',
      end: '19:30',
    };
    FIXTURE_SUB_REQUESTS.push(req);

    return { absenceId, createdRequests: [req] };
  },

  async coverQueue(schoolId: string): Promise<SubstituteRequest[]> {
    const teacherIds = new Set(FIXTURE_SCHOOL_TEACHERS[schoolId] ?? []);
    return FIXTURE_SUB_REQUESTS.filter(
      (r) => r.status === 'open' && teacherIds.has(r.originalTeacherId),
    );
  },

  async candidates(requestId: string): Promise<SubstituteCandidate[]> {
    const req = FIXTURE_SUB_REQUESTS.find((r) => r.requestId === requestId);
    if (!req) return [];

    const lessonDuration =
      (parseInt(req.end.replace(':', '')) - parseInt(req.start.replace(':', ''))) / 100;

    const pool = Object.entries(FIXTURE_TEACHER_META)
      .filter(([tid]) => tid !== req.originalTeacherId)
      .map(([tid, meta]) => {
        const maxHours = FIXTURE_TEACHER_MAX_HOURS[tid] ?? 20;
        const activeGroups = allActiveGroupsForOps();
        const load = teacherLoad({ id: tid, maxWeeklyHours: maxHours }, activeGroups);
        const langs = FIXTURE_TEACHER_LANGS[tid] ?? [];
        const mySlots = activeGroups
          .filter((g) => g.primaryTeacherId === tid || g.coPrimaryTeacherId === tid)
          .flatMap((g) => g.slots);
        const isFree = !mySlots.some(
          (s) => s.day === req.day &&
            parseInt(s.start.replace(':', '')) < parseInt(req.end.replace(':', '')) &&
            parseInt(s.end.replace(':', '')) > parseInt(req.start.replace(':', '')),
        );
        return {
          teacherId: tid,
          name: meta.name,
          avatarUrl: meta.avatarUrl,
          langs,
          currentContactHours: load.hours,
          maxWeeklyContactHours: maxHours,
          isFreeAtSlot: isFree,
          isFamiliar: activeGroups.some(
            (g) =>
              (g.primaryTeacherId === tid || g.coPrimaryTeacherId === tid) &&
              g.id === req.groupId,
          ),
          isSubLoop: false,
        };
      });

    return rankCandidates(pool, { lang: req.lang, durationHours: lessonDuration }, WORKLOAD_POLICY);
  },

  async assignSubstitute(
    requestId: string,
    substituteTeacherId: string,
    _override?: boolean,
  ): Promise<MutationResult> {
    const idx = FIXTURE_SUB_REQUESTS.findIndex((r) => r.requestId === requestId);
    if (idx === -1) return { ok: false, error: 'Request not found' };

    const req = FIXTURE_SUB_REQUESTS[idx]!;
    const activeGroups = allActiveGroupsForOps();
    const maxHours = FIXTURE_TEACHER_MAX_HOURS[substituteTeacherId] ?? 20;
    const load = teacherLoad({ id: substituteTeacherId, maxWeeklyHours: maxHours }, activeGroups);
    const lessonDuration =
      (parseInt(req.end.replace(':', '')) - parseInt(req.start.replace(':', ''))) / 100;

    if (load.hours + lessonDuration > maxHours && !_override) {
      return { ok: false, error: 'cap_exceeded' };
    }

    FIXTURE_SUB_REQUESTS[idx] = { ...req, status: 'closed' };
    return { ok: true };
  },

  async getCurriculum(groupId: string): Promise<CurriculumPlan> {
    return (
      FIXTURE_CURRICULUM[groupId] ?? {
        planId: `plan-${groupId}`,
        groupId,
        units: [],
        targetWeeklyHours: WORKLOAD_POLICY.HOURS_PER_GROUP_DEFAULT,
        progressPct: 0,
      }
    );
  },

  async putCurriculum(groupId: string, plan: CurriculumPlan): Promise<void> {
    FIXTURE_CURRICULUM[groupId] = plan;
  },

  async computeForecast(schoolId: string, params: ForecastParams): Promise<ForecastResult> {
    const teacherIds = FIXTURE_SCHOOL_TEACHERS[schoolId] ?? [];
    const activeGroups = allActiveGroupsForOps();

    const langCounts: Record<string, { teacherCount: number; groupCount: number; studentCount: number }> = {};
    for (const tid of teacherIds) {
      const langs = FIXTURE_TEACHER_LANGS[tid] ?? [];
      for (const lang of langs) {
        if (!langCounts[lang]) langCounts[lang] = { teacherCount: 0, groupCount: 0, studentCount: 0 };
        langCounts[lang]!.teacherCount++;
      }
    }
    for (const g of activeGroups) {
      const meta = FIXTURE_GROUP_META[g.id];
      if (!meta) continue;
      if (!langCounts[meta.lang]) langCounts[meta.lang] = { teacherCount: 0, groupCount: 0, studentCount: 0 };
      langCounts[meta.lang]!.groupCount++;
      langCounts[meta.lang]!.studentCount += g.studentCount;
    }

    const totalStudents = activeGroups.reduce((acc, g) => acc + g.studentCount, 0);

    const baseline = {
      studentCount: totalStudents,
      activeTeacherCount: teacherIds.length,
      perLanguage: Object.entries(langCounts).map(([lang, counts]) => ({ lang, ...counts })),
    };

    return computeForecast(params, baseline);
  },
};
