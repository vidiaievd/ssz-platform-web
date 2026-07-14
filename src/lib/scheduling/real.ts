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
import type { Absence, SubstituteRequest, SubstituteCandidate, CurriculumPlan } from '@/features/teachers/types';
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

  async coverQueue(schoolId: string) {
    const rows = await serverFetch<Array<{
      id: string; lessonId: string; groupId: string; originalTeacherId: string;
      coverFrom: string; coverTo: string; urgency: string; status: string;
    }>>({
      service: 'scheduling',
      path: `/scheduling/schools/${schoolId}/substitutions`,
    });
    if (!rows.length) return [];

    // Enrichment: group name/lang from org-service, lesson times from the
    // per-group lessons projection across the full cover window.
    const [groups, lessonById] = await Promise.all([
      serverFetch<Array<{ id: string; name: string; lang?: string }>>({
        service: 'organization',
        path: `/schools/${schoolId}/groups`,
      }).catch(() => []),
      (async () => {
        const groupIds = [...new Set(rows.map((r) => r.groupId))];
        const from = rows.map((r) => r.coverFrom.slice(0, 10)).reduce((a, b) => (a < b ? a : b));
        const to = rows.map((r) => r.coverTo.slice(0, 10)).reduce((a, b) => (a > b ? a : b));
        const byId = new Map<string, { id: string; date: string; startTime: string; endTime: string }>();
        await Promise.all(
          groupIds.map(async (gid) => {
            const lessons = await serverFetch<Array<{ id: string; date: string; startTime: string; endTime: string }>>({
              service: 'scheduling',
              path: `/scheduling/groups/${gid}/lessons`,
              query: { from, to },
            }).catch(() => []);
            for (const l of lessons) byId.set(l.id, l);
          }),
        );
        return byId;
      })(),
    ]);
    const groupById = new Map(groups.map((g) => [g.id, g]));

    const WEEKDAYS: Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return rows.map((r): SubstituteRequest => {
      const group = groupById.get(r.groupId);
      const lesson = lessonById.get(r.lessonId);
      const dateStr = lesson?.date ?? r.coverFrom.slice(0, 10);
      return {
        requestId: r.id,
        lessonId: r.lessonId,
        groupId: r.groupId,
        groupName: group?.name ?? '',
        originalTeacherId: r.originalTeacherId,
        coverWindow: { from: r.coverFrom.slice(0, 10), to: r.coverTo.slice(0, 10) },
        urgency: (['today', 'upcoming', 'open'].includes(r.urgency) ? r.urgency : 'open') as SubstituteRequest['urgency'],
        status: (['open', 'closed', 'cancelled'].includes(r.status) ? r.status : 'open') as SubstituteRequest['status'],
        lang: (group?.lang ?? 'en') as SubstituteRequest['lang'],
        day: WEEKDAYS[new Date(`${dateStr}T00:00:00Z`).getUTCDay()] ?? 'Mon',
        start: lesson?.startTime ?? '00:00',
        end: lesson?.endTime ?? '00:00',
      };
    });
  },

  async candidates(schoolId: string, requestId: string) {
    // The ranking service returns its full scoring breakdown (capScore 0-40,
    // disrScore 0-20, …) alongside the declared CandidateDto fields.
    const [cands, members] = await Promise.all([
      serverFetch<Array<{
        teacherId: string; eligible: boolean; fitScore: number; reasons: string[];
        capScore?: number; disrScore?: number;
      }>>({
        service: 'scheduling',
        path: `/scheduling/substitutions/${requestId}/candidates`,
      }),
      serverFetch<Array<{ userId: string; name?: string; avatarUrl?: string | null }>>({
        service: 'organization',
        path: `/schools/${schoolId}/members`,
        query: { role: 'TEACHER' },
      }).catch(() => []),
    ]);
    const memberById = new Map(members.map((m) => [m.userId, m]));

    return cands.map((c): SubstituteCandidate => {
      const member = memberById.get(c.teacherId);
      const spareRatio = (c.capScore ?? 0) / 40;
      return {
        teacherId: c.teacherId,
        name: member?.name ?? '',
        avatarUrl: member?.avatarUrl ?? null,
        eligible: c.eligible,
        fitScore: c.fitScore,
        classification: !c.eligible ? 'ineligible' : c.fitScore >= 75 ? 'best' : c.fitScore >= 50 ? 'good' : 'ok',
        factors: {
          canLang: !c.reasons.includes('language-mismatch'),
          free: !c.reasons.includes('schedule-conflict'),
          spareRatio,
          familiar: c.reasons.includes('familiar-with-group'),
          wouldOverload: c.eligible && spareRatio <= 0,
          subLoop: c.eligible && (c.disrScore ?? 20) < 20,
        },
      };
    });
  },

  async assignSubstitute(requestId: string, substituteTeacherId: string) {
    await serverFetch({
      service: 'scheduling',
      path: `/scheduling/substitutions/${requestId}/assign`,
      method: 'POST',
      body: { substituteTeacherId },
    });
    return { ok: true } as const;
  },

  async getCurriculum(groupId: string) {
    const plan = await serverFetch<{
      id: string;
      groupId: string;
      targetWeeklyHours: number;
      units: Array<{
        id: string; title: string; order: number;
        plannedSessions: number; deliveredSessions: number;
        requiredLevel: string | null; status: string;
      }>;
    } | null>({
      service: 'scheduling',
      path: `/scheduling/groups/${groupId}/curriculum`,
    });
    if (!plan) {
      return { planId: '', groupId, units: [], targetWeeklyHours: 0, progressPct: 0 };
    }

    const units = plan.units.map((u): CurriculumPlan['units'][number] => ({
      unitId: u.id,
      title: u.title,
      order: u.order,
      plannedSessions: u.plannedSessions,
      deliveredSessions: u.deliveredSessions,
      requiredLevel: (u.requiredLevel ?? 'A1') as CurriculumPlan['units'][number]['requiredLevel'],
      status: (['planned', 'active', 'done', 'overridden'].includes(u.status) ? u.status : 'planned') as CurriculumPlan['units'][number]['status'],
    }));
    const planned = units.reduce((sum, u) => sum + u.plannedSessions, 0);
    const delivered = units.reduce((sum, u) => sum + Math.min(u.deliveredSessions, u.plannedSessions), 0);

    return {
      planId: plan.id,
      groupId: plan.groupId,
      units,
      targetWeeklyHours: plan.targetWeeklyHours,
      progressPct: planned > 0 ? Math.round((delivered / planned) * 100) : 0,
    };
  },

  async putCurriculum(groupId: string, plan: CurriculumPlan) {
    // The upsert endpoint replaces the full unit list; order = array order.
    await serverFetch({
      service: 'scheduling',
      path: `/scheduling/groups/${groupId}/curriculum`,
      method: 'PUT',
      body: {
        targetWeeklyHours: plan.targetWeeklyHours,
        units: [...plan.units]
          .sort((a, b) => a.order - b.order)
          .map((u) => ({
            title: u.title,
            plannedSessions: u.plannedSessions,
            deliveredSessions: u.deliveredSessions,
            requiredLevel: u.requiredLevel,
            status: u.status,
          })),
      },
    });
  },

  // plan-28: computeForecast — no backend endpoint in scheduling-service
  async computeForecast(_schoolId: string, _params: unknown) { throw notReady(); },
};
