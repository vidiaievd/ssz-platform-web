import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { getMySchools } from '@/features/school/api/get-my-schools';
import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { AppError } from '@/lib/errors';
import type { School } from '@/features/school/types';
import type { MembershipStatus } from '@/features/enrollment/types';
import type { Slot, GroupMode, AgeBand, CEFR } from '@/features/groups/types';
import type {
  StudentSchool,
  SchoolTeacherSummary,
  ScheduleSlot,
  SchoolMaterial,
  NextLesson,
  PendingStage,
} from '../types/learning';

// ── Backend response shapes (org-service) ──────────────────────────────────

type BackendMembership = { id: string; status: MembershipStatus };

type BackendStudentGroupMembership = {
  groupId: string;
  groupName: string;
  level: string | null;
  status: 'active' | 'past';
  teachers: Array<{ userId: string; name: string; avatarUrl: string | null; role: string }>;
};

type OrgGroup = {
  id: string;
  courseId?: string | null;
  mode?: string;
  ageBand?: string | null;
  studentCount?: number;
  materials?: Array<{ id: string; courseId: string }>;
};

async function safeFetch<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function pendingStageFor(status: MembershipStatus): PendingStage | undefined {
  return status === 'onboarding' || status === 'placement-review' ? status : undefined;
}

function mapTeacherRole(r: string): SchoolTeacherSummary['role'] {
  const v = r.toLowerCase();
  if (v === 'co_primary' || v === 'co-primary') return 'co-primary';
  if (v === 'substitute') return 'substitute';
  return 'primary';
}

// organization-service's GroupMode enum uses an underscore ('online' | 'in_person');
// the frontend's GroupMode type uses a hyphen ('online' | 'in-person').
function mapMode(m?: string): GroupMode | null {
  if (!m) return null;
  return m.toLowerCase() === 'in_person' ? 'in-person' : 'online';
}

const WEEKDAY_ORDER: Slot['day'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Earliest weekly slot occurring on/after now, computed in server-local
 * (UTC) time. A coarse placeholder — Phase E3 replaces this with a
 * timezone-aware computation against the student's own locale.
 */
function computeNextLesson(slots: Slot[]): NextLesson | null {
  if (!slots.length) return null;
  const now = new Date();
  const todayIdx = (now.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const nowHHMM = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

  let best: { slot: Slot; daysAhead: number } | null = null;
  for (const slot of slots) {
    const slotIdx = WEEKDAY_ORDER.indexOf(slot.day);
    if (slotIdx === -1) continue;
    let daysAhead = (slotIdx - todayIdx + 7) % 7;
    if (daysAhead === 0 && slot.start <= nowHHMM) daysAhead = 7;
    if (!best || daysAhead < best.daysAhead) best = { slot, daysAhead };
  }
  if (!best) return null;

  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + best.daysAhead);
  return { day: best.slot.day, start: best.slot.start, end: best.slot.end, date: date.toISOString().slice(0, 10) };
}

/**
 * Resolves course titles for however many distinct courseIds a group
 * references (main + additional materials). organization-service only knows
 * courseId — the title lives in content-service — so this is a separate,
 * best-effort lookup: an individual failure degrades that course's name to
 * null rather than failing the whole row.
 */
async function resolveCourseNames(courseIds: Array<string | null | undefined>): Promise<Map<string, string>> {
  const unique = [...new Set(courseIds.filter((id): id is string => !!id))];
  const entries = await Promise.all(
    unique.map(async (id) => {
      const c = await safeFetch<{ title: string }>(() => serverFetch({ service: 'content', path: `/containers/${id}` }));
      return [id, c?.title ?? null] as const;
    }),
  );
  return new Map(entries.filter((e): e is [string, string] => e[1] !== null));
}

function baseStudentSchool(school: School, membership: BackendMembership): StudentSchool {
  return {
    membershipId: membership.id,
    schoolId: school.id,
    schoolSlug: school.slug ?? '',
    schoolName: school.name,
    status: membership.status,
    pendingStage: pendingStageFor(membership.status),
    groupId: null,
    groupName: null,
    level: null,
    mode: null,
    ageBand: null,
    teachers: [],
    schedule: [],
    nextLesson: null,
    mainCourse: null,
    materials: [],
    classmateCount: null,
  };
}

/**
 * One row per school the student belongs to, enriched with group/schedule/
 * teacher/material data for `active` memberships only — non-active rows
 * stop at `pendingStage`, there is nothing else to show yet.
 */
async function buildStudentSchool(school: School, myUserId: string): Promise<StudentSchool | null> {
  const membership = await safeFetch<BackendMembership>(() =>
    serverFetch({ service: 'organization', path: `/schools/${school.id}/memberships/me` }),
  );
  // No enrollment record for this school membership (shouldn't normally happen for
  // a STUDENT-role school, but degrade gracefully rather than 500 the whole list).
  if (!membership) return null;

  const base = baseStudentSchool(school, membership);
  if (membership.status !== 'active') return base;

  const groupMemberships = await safeFetch<BackendStudentGroupMembership[]>(() =>
    serverFetch({ service: 'organization', path: `/schools/${school.id}/students/${myUserId}/memberships` }),
  );
  const activeGroup = groupMemberships?.find((g) => g.status === 'active');
  if (!activeGroup) return base;

  const scheduling = getSchedulingProvider();
  const [rawGroup, slots] = await Promise.all([
    safeFetch<OrgGroup>(() => serverFetch({ service: 'organization', path: `/schools/${school.id}/groups/${activeGroup.groupId}` })),
    scheduling.getSlots(school.id, activeGroup.groupId).catch((err) => {
      if (!(err instanceof AppError && err.code === 'upstream_unavailable')) throw err;
      return [] as Slot[];
    }),
  ]);

  const courseNames = await resolveCourseNames([rawGroup?.courseId, ...(rawGroup?.materials ?? []).map((m) => m.courseId)]);

  const mainCourse: SchoolMaterial | null = rawGroup?.courseId
    ? { id: rawGroup.courseId, courseId: rawGroup.courseId, courseName: courseNames.get(rawGroup.courseId) ?? null, isMain: true }
    : null;

  const materials: SchoolMaterial[] = (rawGroup?.materials ?? []).map((m) => ({
    id: m.id,
    courseId: m.courseId,
    courseName: courseNames.get(m.courseId) ?? null,
    isMain: false,
  }));

  const schedule: ScheduleSlot[] = slots.map((s) => ({ day: s.day, start: s.start, end: s.end, room: s.room }));

  const teachers: SchoolTeacherSummary[] = activeGroup.teachers.map((t) => ({
    userId: t.userId,
    name: t.name,
    avatarUrl: t.avatarUrl,
    role: mapTeacherRole(t.role),
  }));

  return {
    ...base,
    groupId: activeGroup.groupId,
    groupName: activeGroup.groupName,
    level: (activeGroup.level ?? null) as CEFR | null,
    mode: mapMode(rawGroup?.mode),
    ageBand: (rawGroup?.ageBand ?? null) as AgeBand | null,
    teachers,
    schedule,
    nextLesson: computeNextLesson(slots),
    mainCourse,
    materials,
    classmateCount: rawGroup?.studentCount ?? null,
  };
}

async function getStudentRoleSchools(): Promise<School[]> {
  const schools = await getMySchools();
  return schools.filter((s) => s.myRole === 'STUDENT');
}

export async function getStudentSchools(myUserId: string): Promise<StudentSchool[]> {
  const schools = await getStudentRoleSchools();
  const results = await Promise.all(schools.map((s) => buildStudentSchool(s, myUserId)));
  return results.filter((s): s is StudentSchool => s !== null);
}

export async function getStudentSchool(myUserId: string, schoolSlug: string): Promise<StudentSchool | null> {
  const schools = await getStudentRoleSchools();
  const school = schools.find((s) => s.slug === schoolSlug);
  if (!school) return null;
  return buildStudentSchool(school, myUserId);
}
