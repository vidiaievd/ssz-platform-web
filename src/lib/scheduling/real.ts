/**
 * Real scheduling provider — forwards to the scheduling-service over the BFF
 * server fetcher. Methods backed by a shipped scheduling-service endpoint are
 * implemented; the rest still throw `notReady()` (an `upstream_unavailable`
 * AppError) so callers degrade gracefully until those endpoints are wired.
 */

import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type {
  Slot,
  Weekday,
  TeacherAvailability,
  RawTimetableEntry,
  RawSchoolTimetableEntry,
  Lesson,
  OpsWarning,
} from '@/features/groups/types';
import type { Absence, SubstituteRequest } from '@/features/teachers/types';
import type { SchedulingProvider } from './provider';

const notReady = () => new AppError('upstream_unavailable', 'scheduling-service not ready');

// scheduling-service uses lowercase weekday codes; the web app uses capitalized.
const WEEKDAY_TO_API: Record<Weekday, string> = {
  Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun',
};
const WEEKDAY_FROM_API: Record<string, Weekday> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

interface ApiSlot {
  id: string;
  groupId: string;
  schoolId: string;
  weekday: string;
  startTime: string;
  endTime: string;
  room: string | null;
  createdAt: string;
}

function fromApiSlot(s: ApiSlot): Slot {
  return {
    id: s.id,
    day: WEEKDAY_FROM_API[s.weekday] ?? 'Mon',
    start: s.startTime,
    end: s.endTime,
    room: s.room ?? '',
  };
}

function toApiSlotInput(s: Slot): { weekday: string; startTime: string; endTime: string; room: string | null } {
  return {
    weekday: WEEKDAY_TO_API[s.day],
    startTime: s.start,
    endTime: s.end,
    room: s.room.trim() ? s.room : null,
  };
}

export const realProvider: SchedulingProvider = {
  async getSlots(schoolId: string, groupId: string) {
    const rows = await serverFetch<ApiSlot[]>({
      service: 'scheduling',
      path: `/scheduling/schools/${schoolId}/groups/${groupId}/slots`,
    });
    return rows.map(fromApiSlot);
  },

  async putSlots(schoolId: string, groupId: string, slots: Slot[]) {
    await serverFetch({
      service: 'scheduling',
      path: `/scheduling/schools/${schoolId}/groups/${groupId}/slots`,
      method: 'PUT',
      body: { slots: slots.map(toApiSlotInput) },
    });
  },

  async teachersAvailability(schoolId: string, slots: Array<Pick<Slot, 'day' | 'start' | 'end'>>) {
    const apiSlots = slots.map((s) => ({
      weekday: WEEKDAY_TO_API[s.day],
      startTime: s.start,
      endTime: s.end,
    }));
    return serverFetch<TeacherAvailability[]>({
      service: 'scheduling',
      path: `/scheduling/schools/${schoolId}/teachers/availability`,
      query: { slots: JSON.stringify(apiSlots) },
    });
  },

  async nextLessons(groupId: string, limit: number) {
    const rows = await serverFetch<Array<{
      id: string; groupId: string; date: string; startTime: string; endTime: string;
      teacherId: string; room: string | null; status: string;
    }>>({
      service: 'scheduling',
      path: `/scheduling/groups/${groupId}/lessons/next`,
      query: { limit: String(limit) },
    });
    return rows.map((r): Lesson => ({
      id: r.id,
      groupId: r.groupId,
      date: r.date,
      start: r.startTime,
      end: r.endTime,
      teacherId: r.teacherId,
      teacherName: '', // enriched by BFF caller when needed
      room: r.room ?? '',
      isSubstitute: false,
    }));
  },

  async schoolTimetable(schoolId: string) {
    const rows = await serverFetch<
      Array<{ teacherId: string; weekday: string; startTime: string; endTime: string; groupId: string; room: string | null }>
    >({
      service: 'scheduling',
      path: `/scheduling/schools/${schoolId}/teachers/timetable`,
    });
    return rows.map((r): RawSchoolTimetableEntry => ({
      teacherId: r.teacherId,
      day: WEEKDAY_FROM_API[r.weekday] ?? 'Mon',
      start: r.startTime,
      end: r.endTime,
      groupId: r.groupId,
      room: r.room ?? null,
    }));
  },

  async teacherWeek(schoolId: string, teacherId: string) {
    const rows = await serverFetch<
      Array<{ weekday: string; startTime: string; endTime: string; groupId: string; room: string | null }>
    >({
      service: 'scheduling',
      path: `/scheduling/schools/${schoolId}/teachers/${teacherId}/timetable`,
    });
    return rows.map((r): RawTimetableEntry => ({
      day: WEEKDAY_FROM_API[r.weekday] ?? 'Mon',
      start: r.startTime,
      end: r.endTime,
      groupId: r.groupId,
      room: r.room ?? null,
    }));
  },

  async teacherConflicts(schoolId: string) {
    const rows = await serverFetch<Array<{ teacherId: string; date: string; lessonAId: string; lessonBId: string }>>({
      service: 'scheduling',
      path: `/scheduling/schools/${schoolId}/conflicts`,
    });
    return rows.map((r): OpsWarning => ({ type: 'conflict', with: r.teacherId, time: r.date }));
  },

  async studentClashes(schoolId: string, userId: string) {
    const rows = await serverFetch<Array<{ lessonAId: string; lessonBId: string; date: string; groupAId: string; groupBId: string; startTime: string }>>({
      service: 'scheduling',
      path: `/scheduling/schools/${schoolId}/students/${userId}/clashes`,
    });
    return rows.map((r): OpsWarning => ({ type: 'clash', with: r.groupBId, time: r.startTime }));
  },

  // plan-28: no GET/PUT per-teacher availability endpoint in scheduling-service yet
  async getAvailability(_teacherId: string) { throw notReady(); },
  async putAvailability(_teacherId: string, _blocks: unknown[]) { throw notReady(); },

  async listAbsences(schoolId: string) {
    const rows = await serverFetch<Array<{
      id: string; teacherId: string; kind: string; scope: string;
      fromDate: string; toDate: string | null; reason: string;
    }>>({
      service: 'scheduling',
      path: `/scheduling/schools/${schoolId}/absences`,
    });
    return rows.map((r): Absence => ({
      absenceId: r.id,
      teacherId: r.teacherId,
      kind: r.kind as Absence['kind'],
      scope: r.scope as Absence['scope'],
      from: r.fromDate,
      to: r.toDate,
      reason: r.reason,
      affectedLessonCount: 0, // not returned by service; enrichment pending
      coveredCount: 0,
    }));
  },

  async reportAbsence(input) {
    const row = await serverFetch<{ id: string }>({
      service: 'scheduling',
      path: `/scheduling/schools/${input.schoolId}/teachers/${input.teacherId}/absences`,
      method: 'POST',
      body: {
        kind: input.kind,
        scope: input.scope,
        fromDate: input.from,
        toDate: input.to,
        reason: input.reason,
      },
    });
    // Backend auto-generates substitute requests internally; they're not returned here.
    return { absenceId: row.id, createdRequests: [] as SubstituteRequest[] };
  },

  // plan-28: coverQueue needs lesson enrichment (groupName, lang, day, start, end) not in SubRequestResponseDto
  async coverQueue(_schoolId: string) { throw notReady(); },

  // plan-28: candidates needs teacher enrichment (name, avatarUrl, classification, factors) not in CandidateDto
  async candidates(_requestId: string) { throw notReady(); },

  async assignSubstitute(requestId: string, substituteTeacherId: string) {
    await serverFetch({
      service: 'scheduling',
      path: `/scheduling/substitutions/${requestId}/assign`,
      method: 'POST',
      body: { substituteTeacherId },
    });
    return { ok: true } as const;
  },

  // plan-28: getCurriculum/putCurriculum — backend units lack unitId in response; needs schema update
  async getCurriculum(_groupId: string) { throw notReady(); },
  async putCurriculum(_groupId: string, _plan: unknown) { throw notReady(); },

  // plan-28: computeForecast — no backend endpoint in scheduling-service
  async computeForecast(_schoolId: string, _params: unknown) { throw notReady(); },
};
