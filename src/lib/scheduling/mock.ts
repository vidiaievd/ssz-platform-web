/**
 * Deterministic mock scheduling provider.
 * All data comes from fixtures.ts — no randomness, no network calls.
 * Switch to real.ts via SCHEDULING_BACKEND=real env flag.
 */

import type { Slot, Lesson, TimetableTeacher, OpsWarning } from '@/features/groups/types';
import type { SchedulingProvider } from './provider';
import {
  FIXTURE_SLOTS,
  FIXTURE_DEFAULT_SLOTS,
  FIXTURE_TEACHER_MAX_HOURS,
  FIXTURE_TEACHER_META,
  FIXTURE_SCHOOL_TEACHERS,
  FIXTURE_GROUP_META,
} from './fixtures';
import {
  teacherLoad,
  teacherConflicts,
  nextLessons as computeNextLessons,
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
    // In-memory mutation for tests (resets on process restart).
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
        // Emit one warning per conflicting group pair
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
    // No student clash fixtures yet — returns empty for now.
    return [];
  },
};
