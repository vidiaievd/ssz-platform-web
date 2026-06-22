/**
 * Real scheduling provider — forwards to the scheduling-service over the BFF
 * server fetcher. Methods backed by a shipped scheduling-service endpoint are
 * implemented; the rest still throw `notReady()` (an `upstream_unavailable`
 * AppError) so callers degrade gracefully until those endpoints are wired.
 */

import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { Slot, Weekday, TeacherAvailability } from '@/features/groups/types';
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

  async nextLessons(_groupId: string, _limit: number) { throw notReady(); },
  async teacherTimetable(_schoolId: string) { throw notReady(); },
  async teacherConflicts(_schoolId: string) { throw notReady(); },
  async studentClashes(_schoolId: string, _userId: string) { throw notReady(); },
  async commandCenter(_schoolId: string) { throw notReady(); },
  async getAvailability(_teacherId: string) { throw notReady(); },
  async putAvailability(_teacherId: string, _blocks: unknown[]) { throw notReady(); },
  async listAbsences(_schoolId: string) { throw notReady(); },
  async reportAbsence(_input: unknown) { throw notReady(); },
  async coverQueue(_schoolId: string) { throw notReady(); },
  async candidates(_requestId: string) { throw notReady(); },
  async assignSubstitute(_requestId: string, _substituteTeacherId: string) { throw notReady(); },
  async getCurriculum(_groupId: string) { throw notReady(); },
  async putCurriculum(_groupId: string, _plan: unknown) { throw notReady(); },
  async computeForecast(_schoolId: string, _params: unknown) { throw notReady(); },
};
