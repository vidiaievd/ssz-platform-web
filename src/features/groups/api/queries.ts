import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { AppError } from '@/lib/errors';
import { groupAlerts, teacherLoad, slotsOverlap, type GroupForOps } from '@/lib/groups/operations';
// groupCacheTags are used by mutations (revalidateTag) — queries use no-store for now
// until serverFetch is extended to accept next.tags.
import type {
  Group,
  GroupHealthRowVM,
  RosterStudent,
  TimetableTeacher,
  GroupTeacher,
  Slot,
} from '@/features/groups/types';
import type { Alert } from '@/features/dashboard/types';
import type { AlertType, AlertSeverity } from '@/lib/groups/operations';

// ── Internal helpers ──────────────────────────────────────────────────────────

type OrgGroup = {
  id: string;
  name: string;
  courseId?: string | null;
  courseName?: string | null;
  lang?: string;
  level?: string;
  status?: string;
  mode?: string;
  minCapacity?: number;
  maxCapacity?: number;
  studentCount?: number;
  startDate?: string | null;
  endDate?: string | null;
  teachers?: Array<{
    userId: string;
    name?: string;
    avatarUrl?: string | null;
    role?: string;
    from?: string;
    to?: string;
    reason?: string;
    maxWeeklyHours?: number;
    langs?: string[];
  }>;
};

type OrgMember = {
  userId: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  role?: string;
  maxWeeklyHours?: number;
  langs?: string[];
};

function mapGroupStatus(s?: string): Group['status'] {
  if (s === 'ACTIVE') return 'active';
  if (s === 'ARCHIVED') return 'archived';
  return 'draft';
}

function mapGroupMode(m?: string): Group['mode'] {
  return m?.toLowerCase() === 'in-person' ? 'in-person' : 'online';
}

function mapTeacherRole(r?: string): GroupTeacher['role'] {
  if (r === 'CO_PRIMARY' || r === 'co-primary') return 'co-primary';
  if (r === 'SUBSTITUTE' || r === 'substitute') return 'substitute';
  return 'primary';
}

function buildGroupForOps(g: OrgGroup, slots: Slot[]): GroupForOps {
  const primary = g.teachers?.find((t) => mapTeacherRole(t.role) === 'primary');
  const coPrimary = g.teachers?.find((t) => mapTeacherRole(t.role) === 'co-primary');
  return {
    id: g.id,
    status: mapGroupStatus(g.status),
    primaryTeacherId: primary?.userId ?? null,
    coPrimaryTeacherId: coPrimary?.userId ?? null,
    slots,
    studentCount: g.studentCount ?? 0,
    capacity: { min: g.minCapacity ?? 0, max: g.maxCapacity ?? 999 },
  };
}

function buildScheduleSummary(slots: Slot[]): string {
  if (!slots.length) return '—';
  const sorted = [...slots].sort((a, b) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.indexOf(a.day) - days.indexOf(b.day);
  });
  const days = [...new Set(sorted.map((s) => s.day))].join('/');
  const time = sorted[0]?.start ?? '';
  return `${days} ${time}`.trim();
}

async function safeOrgFetch<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

// ── Public fetchers ───────────────────────────────────────────────────────────

export type GetGroupsResult = {
  groups: GroupHealthRowVM[];
  schedulingError: string | null;
};

/**
 * Groups list with ops-derived health view models.
 * Used by the groups list RSC page.
 */
export async function getGroups(
  schoolId: string,
  _opts?: { role?: string },
): Promise<GetGroupsResult> {
  const scheduling = getSchedulingProvider();

  const rawGroups = await safeOrgFetch<OrgGroup[]>(() =>
    serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/groups`,
    }),
  );
  if (!rawGroups) return { groups: [], schedulingError: null };

  // Fetch all slots in parallel; a scheduling outage degrades to empty
  // slots per group instead of failing the whole page.
  let schedulingError: string | null = null;
  const slotsMap = await Promise.all(
    rawGroups.map((g) =>
      scheduling
        .getSlots(g.id)
        .then((s) => ({ id: g.id, slots: s }))
        .catch((err) => {
          if (!(err instanceof AppError && err.code === 'upstream_unavailable')) throw err;
          schedulingError = err.message;
          return { id: g.id, slots: [] as Slot[] };
        }),
    ),
  ).then((entries) => Object.fromEntries(entries.map((e) => [e.id, e.slots])));

  const allForOps = rawGroups.map((g) => buildGroupForOps(g, slotsMap[g.id] ?? []));

  // Build teacher max-hours map (from org teacher metadata)
  const teacherMaxHours: Record<string, number | null> = {};
  for (const g of rawGroups) {
    for (const t of g.teachers ?? []) {
      if (!(t.userId in teacherMaxHours)) {
        teacherMaxHours[t.userId] = t.maxWeeklyHours ?? null;
      }
    }
  }

  const groups = rawGroups.map((g) => {
    const slots = slotsMap[g.id] ?? [];
    const forOps = buildGroupForOps(g, slots);
    const primary = g.teachers?.find((t) => mapTeacherRole(t.role) === 'primary');
    const coPrimary = g.teachers?.find((t) => mapTeacherRole(t.role) === 'co-primary');
    const maxHours = primary ? (teacherMaxHours[primary.userId] ?? null) : null;
    const rawAlerts = groupAlerts(forOps, maxHours, allForOps);
    const alerts: Alert[] = rawAlerts.map((a) => ({
      type: a.type as AlertType,
      severity: a.severity as AlertSeverity,
      label: a.label,
    }));

    return {
      id: g.id,
      name: g.name,
      lang: g.lang ?? 'en',
      level: (g.level ?? 'A1') as GroupHealthRowVM['level'],
      courseName: g.courseName ?? null,
      status: mapGroupStatus(g.status),
      mode: mapGroupMode(g.mode),
      primaryTeacher: primary
        ? { name: primary.name ?? '', avatarUrl: primary.avatarUrl ?? null }
        : null,
      coPrimaryTeacher: coPrimary ? { name: coPrimary.name ?? '' } : null,
      scheduleSummary: buildScheduleSummary(slots),
      studentCount: g.studentCount ?? 0,
      capacity: { min: g.minCapacity ?? 0, max: g.maxCapacity ?? 999 },
      alerts,
    };
  });

  return { groups, schedulingError };
}

/**
 * Single group with full detail + roster + alerts.
 */
export async function getGroup(
  schoolId: string,
  groupId: string,
): Promise<(Group & { roster: RosterStudent[]; alerts: Alert[] }) | null> {
  const scheduling = getSchedulingProvider();

  const [rawGroup, slots, roster] = await Promise.all([
    safeOrgFetch<OrgGroup>(() =>
      serverFetch({
        service: 'organization',
        path: `/schools/${schoolId}/groups/${groupId}`,
      }),
    ),
    scheduling.getSlots(groupId).catch((err): Slot[] => {
      if (!(err instanceof AppError && err.code === 'upstream_unavailable')) throw err;
      return [];
    }),
    safeOrgFetch<OrgMember[]>(() =>
      serverFetch({
        service: 'organization',
        path: `/schools/${schoolId}/groups/${groupId}/members`,
      }),
    ),
  ]);

  if (!rawGroup) return null;

  const allGroups = await safeOrgFetch<OrgGroup[]>(() =>
    serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/groups`,
    }),
  );

  const allForOps = (allGroups ?? [rawGroup]).map((g) =>
    buildGroupForOps(g, g.id === groupId ? slots : []),
  );

  const forOps = buildGroupForOps(rawGroup, slots);
  const primary = rawGroup.teachers?.find((t) => mapTeacherRole(t.role) === 'primary');
  const maxHours = primary?.maxWeeklyHours ?? null;
  const rawAlerts = groupAlerts(forOps, maxHours, allForOps);
  const alerts: Alert[] = rawAlerts.map((a) => ({
    type: a.type as AlertType,
    severity: a.severity as AlertSeverity,
    label: a.label,
  }));

  const teachers: GroupTeacher[] = (rawGroup.teachers ?? []).map((t) => ({
    userId: t.userId,
    name: t.name ?? '',
    avatarUrl: t.avatarUrl ?? null,
    role: mapTeacherRole(t.role),
    from: t.from,
    to: t.to,
    reason: t.reason,
    max: t.maxWeeklyHours,
    langs: t.langs,
  }));

  const group: Group = {
    id: rawGroup.id,
    name: rawGroup.name,
    courseId: rawGroup.courseId ?? null,
    courseName: rawGroup.courseName ?? null,
    lang: rawGroup.lang ?? 'en',
    level: (rawGroup.level ?? 'A1') as Group['level'],
    status: mapGroupStatus(rawGroup.status),
    mode: mapGroupMode(rawGroup.mode),
    capacity: { min: rawGroup.minCapacity ?? 0, max: rawGroup.maxCapacity ?? 999 },
    studentCount: rawGroup.studentCount ?? 0,
    startDate: rawGroup.startDate ?? null,
    endDate: rawGroup.endDate ?? null,
    teachers,
    slots,
  };

  const rosterStudents: RosterStudent[] = (roster ?? []).map((m) => ({
    userId: m.userId,
    name: m.name ?? '',
    email: m.email ?? '',
    avatarUrl: m.avatarUrl ?? null,
    level: 'A1' as RosterStudent['level'],
    status: 'active' as RosterStudent['status'],
    progress: 0,
    hasClash: false,
  }));

  return { ...group, roster: rosterStudents, alerts };
}

type SchoolTeacher = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  maxWeeklyHours: number;
  langs: string[];
};

function mapSchoolTeachers(raw: OrgMember[]): SchoolTeacher[] {
  return raw
    .filter((m) => m.role === 'TEACHER')
    .map((m) => ({
      userId: m.userId,
      name: m.name ?? '',
      avatarUrl: m.avatarUrl ?? null,
      maxWeeklyHours: m.maxWeeklyHours ?? 20,
      langs: m.langs ?? [],
    }));
}

/**
 * School teachers for assign-modal and timetable.
 * Returns members with TEACHER role. Upstream failures degrade to an empty list —
 * use getSchoolTeachersResult where the caller needs to distinguish failure from
 * a genuinely empty roster.
 */
export async function getSchoolTeachers(schoolId: string): Promise<SchoolTeacher[]> {
  const raw = await safeOrgFetch<OrgMember[]>(() =>
    serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/members`,
      query: { role: 'TEACHER' },
    }),
  );
  return raw ? mapSchoolTeachers(raw) : [];
}

/**
 * Same as getSchoolTeachers, but surfaces upstream failures instead of
 * silently degrading to an empty list — for screens where "no teachers"
 * and "failed to load teachers" must be rendered differently.
 */
export async function getSchoolTeachersResult(
  schoolId: string,
): Promise<{ teachers: SchoolTeacher[]; error: string | null }> {
  try {
    const raw = await serverFetch<OrgMember[]>({
      service: 'organization',
      path: `/schools/${schoolId}/members`,
      query: { role: 'TEACHER' },
    });
    return { teachers: mapSchoolTeachers(raw), error: null };
  } catch (err) {
    if (err instanceof AppError) return { teachers: [], error: err.message };
    throw err;
  }
}

/**
 * Teacher timetable view model for the timetable page.
 */
export type TimetableResult = { data: TimetableTeacher[] } | { error: string };

export async function getTimetable(schoolId: string): Promise<TimetableResult> {
  const scheduling = getSchedulingProvider();
  try {
    const data = await scheduling.teacherTimetable(schoolId);
    return { data };
  } catch (err) {
    if (err instanceof AppError && err.code === 'upstream_unavailable') {
      return { data: [] };
    }
    console.error('[groups/queries] teacherTimetable failed:', err);
    return { error: err instanceof Error ? err.message : 'Failed to load timetable' };
  }
}

/**
 * Teacher load summaries (used by assign-modal to show live load).
 */
export async function getTeacherLoads(
  schoolId: string,
): Promise<Record<string, ReturnType<typeof teacherLoad>>> {
  const scheduling = getSchedulingProvider();
  const [teachers, timetableTeachers] = await Promise.all([
    getSchoolTeachers(schoolId),
    scheduling.teacherTimetable(schoolId).catch((err) => {
      console.error('[groups/queries] teacherTimetable failed:', err);
      return [] as TimetableTeacher[];
    }),
  ]);

  const result: Record<string, ReturnType<typeof teacherLoad>> = {};
  for (const t of teachers) {
    const tt = timetableTeachers.find((tt) => tt.userId === t.userId);
    result[t.userId] = {
      hours: tt?.hours ?? 0,
      max: t.maxWeeklyHours,
      pct: tt?.pct ?? 0,
      overloaded: tt?.overloaded ?? false,
      groups: tt?.groups ?? 0,
      conflicts: tt?.conflicts ?? 0,
    };
  }
  return result;
}

// ── Modal data fetchers ───────────────────────────────────────────────────────

export type TeacherAssignCandidate = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  maxWeeklyHours: number;
  langs: string[];
  currentHours: number;
  currentGroups: number;
  currentConflicts: number;
  langFit: boolean;
  conflictsWithGroup: boolean;
};

/**
 * All teachers for the assign-teacher modal with pre-computed conflict/fit flags.
 */
export async function getTeacherAssignCandidates(
  schoolId: string,
  groupId: string,
): Promise<{
  groupName: string;
  groupLang: string;
  groupSlots: Slot[];
  candidates: TeacherAssignCandidate[];
}> {
  const [groupData, teachers, timetableResult] = await Promise.all([
    getGroup(schoolId, groupId),
    getSchoolTeachers(schoolId),
    getTimetable(schoolId),
  ]);

  if (!groupData) {
    return { groupName: '', groupLang: 'en', groupSlots: [], candidates: [] };
  }

  const timetable = 'data' in timetableResult ? timetableResult.data : [];
  const existingIds = new Set(groupData.teachers.map((t) => t.userId));

  const candidates: TeacherAssignCandidate[] = teachers.map((t) => {
    const tt = timetable.find((x: TimetableTeacher) => x.userId === t.userId);
    // Lessons in the timetable represent recurring weekly slots (day + time).
    const teacherSlots = (tt?.lessons ?? []).map((l) => ({
      day: l.day,
      start: l.start,
      end: l.end,
      room: '',
    }));
    const conflictsWithGroup = groupData.slots.some((gs) =>
      teacherSlots.some((ts) => slotsOverlap(ts, gs)),
    );
    return {
      userId: t.userId,
      name: t.name,
      avatarUrl: t.avatarUrl,
      maxWeeklyHours: t.maxWeeklyHours,
      langs: t.langs,
      currentHours: tt?.hours ?? 0,
      currentGroups: tt?.groups ?? 0,
      currentConflicts: tt?.conflicts ?? 0,
      langFit: t.langs.some((l) => l.toLowerCase() === groupData.lang.toLowerCase()),
      conflictsWithGroup,
    };
  });

  return {
    groupName: groupData.name,
    groupLang: groupData.lang,
    groupSlots: groupData.slots,
    // Exclude teachers already assigned to the group
    candidates: candidates.filter((c) => !existingIds.has(c.userId)),
  };
}

/**
 * All school students (for the wizard, where no group exists yet).
 */
export async function getSchoolStudents(schoolId: string): Promise<StudentCandidate[]> {
  const raw = await safeOrgFetch<OrgMember[]>(() =>
    serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/members`,
      query: { role: 'STUDENT' },
    }),
  );
  if (!raw) return [];
  return raw
    .filter((m) => m.role === 'STUDENT')
    .map((m) => ({
      userId: m.userId,
      name: m.name ?? '',
      email: m.email ?? '',
      avatarUrl: m.avatarUrl ?? null,
      level: 'A1',
    }));
}

export type StudentCandidate = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  level: string;
};

/**
 * School students not yet enrolled in the group — for the add-students modal.
 */
export async function getStudentCandidates(
  schoolId: string,
  groupId: string,
): Promise<{
  groupName: string;
  currentCount: number;
  capacity: { min: number; max: number };
  candidates: StudentCandidate[];
}> {
  const [groupData, allMembers] = await Promise.all([
    getGroup(schoolId, groupId),
    safeOrgFetch<OrgMember[]>(() =>
      serverFetch({
        service: 'organization',
        path: `/schools/${schoolId}/members`,
        query: { role: 'STUDENT' },
      }),
    ),
  ]);

  if (!groupData || !allMembers) {
    return { groupName: '', currentCount: 0, capacity: { min: 0, max: 999 }, candidates: [] };
  }

  const rosterIds = new Set(groupData.roster.map((s) => s.userId));

  const candidates: StudentCandidate[] = allMembers
    .filter((m) => m.role === 'STUDENT' && !rosterIds.has(m.userId))
    .map((m) => ({
      userId: m.userId,
      name: m.name ?? '',
      email: m.email ?? '',
      avatarUrl: m.avatarUrl ?? null,
      level: 'A1',
    }));

  return {
    groupName: groupData.name,
    currentCount: groupData.studentCount,
    capacity: groupData.capacity,
    candidates,
  };
}
