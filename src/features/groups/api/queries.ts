import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { AppError } from '@/lib/errors';
import { groupAlerts, teacherLoad, slotsOverlap, timeToMinutes, type GroupForOps } from '@/lib/groups/operations';
// groupCacheTags are used by mutations (revalidateTag) — queries use no-store for now
// until serverFetch is extended to accept next.tags.
import type {
  Group,
  GroupHealthRowVM,
  RosterStudent,
  TimetableTeacher,
  GroupTeacher,
  Slot,
  CourseView,
  TeacherAvailability,
  TeacherAvailabilityStatus,
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
  capacityMin?: number;
  capacityMax?: number;
  studentCount?: number;
  startDate?: string | null;
  endDate?: string | null;
  ageBand?: string | null;
  teachers?: Array<{
    userId: string;
    role?: string;
    fromDate?: string | null;
    toDate?: string | null;
    reason?: string | null;
  }>;
  materials?: Array<{ id: string; courseId: string; addedAt?: string }>;
  members?: Array<{ userId: string; addedAt?: string }>;
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

// organization-service's GroupMode enum uses an underscore ('online' | 'in_person');
// the frontend's GroupMode type uses a hyphen ('online' | 'in-person').
function mapGroupMode(m?: string): Group['mode'] {
  return m?.toLowerCase() === 'in_person' ? 'in-person' : 'online';
}

// organization-service serializes Date fields as full ISO datetimes
// (e.g. "2026-07-23T00:00:00.000Z"); <input type="date"> requires a bare
// "YYYY-MM-DD" and silently renders empty for anything else.
function toDateOnly(s?: string | null): string | null {
  return s ? s.slice(0, 10) : null;
}

function mapTeacherRole(r?: string): GroupTeacher['role'] {
  if (r === 'CO_PRIMARY' || r === 'co-primary' || r === 'co_primary') return 'co-primary';
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
    capacity: { min: g.capacityMin ?? 0, max: g.capacityMax ?? 999 },
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

// Not organization-only despite the call sites historically being org-service —
// resolveCourseNames() below reuses it against content-service too.
async function safeFetch<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/**
 * Resolves course titles for however many distinct courseIds a group
 * references (main + additional materials). organization-service only knows
 * courseId — the title lives in content-service — so this is a separate,
 * best-effort lookup: an individual failure (deleted/missing container)
 * degrades that one course's name to null rather than failing the whole page.
 */
async function resolveCourseNames(courseIds: Array<string | null | undefined>): Promise<Map<string, string>> {
  const unique = [...new Set(courseIds.filter((id): id is string => !!id))];
  const entries = await Promise.all(
    unique.map(async (id) => {
      const c = await safeFetch<{ title: string }>(() =>
        serverFetch({ service: 'content', path: `/containers/${id}` }),
      );
      return [id, c?.title ?? null] as const;
    }),
  );
  return new Map(
    entries.filter((e): e is [string, string] => e[1] !== null),
  );
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
): Promise<GetGroupsResult> {
  const scheduling = getSchedulingProvider();

  const [rawGroups, schoolTeachers] = await Promise.all([
    safeFetch<OrgGroup[]>(() =>
      serverFetch({
        service: 'organization',
        path: `/schools/${schoolId}/groups`,
      }),
    ),
    getSchoolTeachers(schoolId),
  ]);
  if (!rawGroups) return { groups: [], schedulingError: null };

  // The groups endpoint only returns bare teacher associations (userId + role);
  // join against the school's enriched teacher roster for name/avatar/hours.
  const teachersById = new Map(schoolTeachers.map((t) => [t.userId, t]));

  // Fetch all slots in parallel; a scheduling outage degrades to empty
  // slots per group instead of failing the whole page.
  let schedulingError: string | null = null;
  const slotsMap = await Promise.all(
    rawGroups.map((g) =>
      scheduling
        .getSlots(schoolId, g.id)
        .then((s) => ({ id: g.id, slots: s }))
        .catch((err) => {
          if (!(err instanceof AppError && err.code === 'upstream_unavailable')) throw err;
          schedulingError = err.message;
          return { id: g.id, slots: [] as Slot[] };
        }),
    ),
  ).then((entries) => Object.fromEntries(entries.map((e) => [e.id, e.slots])));

  const allForOps = rawGroups.map((g) => buildGroupForOps(g, slotsMap[g.id] ?? []));
  const courseNames = await resolveCourseNames(rawGroups.map((g) => g.courseId));

  const groups = rawGroups.map((g) => {
    const slots = slotsMap[g.id] ?? [];
    const forOps = buildGroupForOps(g, slots);
    const primary = g.teachers?.find((t) => mapTeacherRole(t.role) === 'primary');
    const coPrimary = g.teachers?.find((t) => mapTeacherRole(t.role) === 'co-primary');
    const primaryInfo = primary ? teachersById.get(primary.userId) : undefined;
    const coPrimaryInfo = coPrimary ? teachersById.get(coPrimary.userId) : undefined;
    const maxHours = primaryInfo?.maxWeeklyHours ?? null;
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
      courseName: (g.courseId && courseNames.get(g.courseId)) ?? null,
      status: mapGroupStatus(g.status),
      mode: mapGroupMode(g.mode),
      primaryTeacher: primaryInfo
        ? { name: primaryInfo.name, avatarUrl: primaryInfo.avatarUrl }
        : null,
      coPrimaryTeacher: coPrimaryInfo ? { name: coPrimaryInfo.name } : null,
      scheduleSummary: buildScheduleSummary(slots),
      studentCount: g.studentCount ?? 0,
      capacity: { min: g.capacityMin ?? 0, max: g.capacityMax ?? 999 },
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

  const [rawGroup, slots, schoolStudents, schoolTeachers] = await Promise.all([
    safeFetch<OrgGroup>(() =>
      serverFetch({
        service: 'organization',
        path: `/schools/${schoolId}/groups/${groupId}`,
      }),
    ),
    scheduling.getSlots(schoolId, groupId).catch((err): Slot[] => {
      if (!(err instanceof AppError && err.code === 'upstream_unavailable')) throw err;
      return [];
    }),
    safeFetch<OrgMember[]>(() =>
      serverFetch({
        service: 'organization',
        path: `/schools/${schoolId}/members`,
        query: { role: 'STUDENT' },
      }),
    ),
    getSchoolTeachers(schoolId),
  ]);

  if (!rawGroup) return null;

  // The group endpoint only returns bare membership rows (userId + addedAt);
  // join against the school's enriched student list for name/email/avatar.
  const studentsById = new Map((schoolStudents ?? []).map((m) => [m.userId, m]));
  const roster: OrgMember[] = (rawGroup.members ?? []).flatMap((member) => {
    const student = studentsById.get(member.userId);
    return student ? [student] : [];
  });

  // The group endpoint's teachers array is a bare association (userId + role +
  // substitute dates); join against the school's enriched teacher roster for
  // name/avatar/langs/weekly-hours.
  const teachersById = new Map(schoolTeachers.map((t) => [t.userId, t]));

  const allGroups = await safeFetch<OrgGroup[]>(() =>
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
  const maxHours = primary ? (teachersById.get(primary.userId)?.maxWeeklyHours ?? null) : null;
  const rawAlerts = groupAlerts(forOps, maxHours, allForOps);
  const alerts: Alert[] = rawAlerts.map((a) => ({
    type: a.type as AlertType,
    severity: a.severity as AlertSeverity,
    label: a.label,
  }));

  const teachers: GroupTeacher[] = (rawGroup.teachers ?? []).map((t) => {
    const info = teachersById.get(t.userId);
    return {
      userId: t.userId,
      name: info?.name ?? '',
      avatarUrl: info?.avatarUrl ?? null,
      role: mapTeacherRole(t.role),
      from: t.fromDate ?? undefined,
      to: t.toDate ?? undefined,
      reason: t.reason ?? undefined,
      max: info?.maxWeeklyHours,
      langs: info?.langs,
    };
  });

  const courseNames = await resolveCourseNames([
    rawGroup.courseId,
    ...(rawGroup.materials ?? []).map((m) => m.courseId),
  ]);

  const materials: Group['materials'] = (rawGroup.materials ?? []).map((m) => ({
    id: m.id,
    courseId: m.courseId,
    courseName: courseNames.get(m.courseId) ?? null,
  }));

  const group: Group = {
    id: rawGroup.id,
    name: rawGroup.name,
    courseId: rawGroup.courseId ?? null,
    courseName: (rawGroup.courseId && courseNames.get(rawGroup.courseId)) ?? null,
    materials,
    lang: rawGroup.lang ?? 'en',
    level: (rawGroup.level ?? 'A1') as Group['level'],
    status: mapGroupStatus(rawGroup.status),
    mode: mapGroupMode(rawGroup.mode),
    capacity: { min: rawGroup.capacityMin ?? 0, max: rawGroup.capacityMax ?? 999 },
    studentCount: rawGroup.studentCount ?? 0,
    startDate: toDateOnly(rawGroup.startDate),
    endDate: toDateOnly(rawGroup.endDate),
    ageBand: (rawGroup.ageBand ?? null) as Group['ageBand'],
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

/**
 * Course view backing CourseChip/CoursePanel. There is no course-detail GET —
 * this derives from Group fields and best-effort enriches with a curriculum
 * unit count. Curriculum lookup failures degrade to `unitCount: null`
 * (the panel omits the line); this function never throws.
 */
export async function getGroupCourseView(group: Group): Promise<CourseView> {
  const base: CourseView = {
    courseId: group.courseId,
    courseName: group.courseName ?? null,
    lang: group.lang,
    level: group.level,
    unitCount: null,
  };

  try {
    const plan = await getSchedulingProvider().getCurriculum(group.id);
    return { ...base, unitCount: plan.units.length };
  } catch {
    return base;
  }
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
  const raw = await safeFetch<OrgMember[]>(() =>
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
 * Counts overlapping pairs among a teacher's own lessons — same heuristic as
 * TimetableGrid's per-day conflict highlighting, aggregated to a single number.
 */
function countConflicts(lessons: TimetableTeacher['lessons']): number {
  let count = 0;
  for (let i = 0; i < lessons.length; i++) {
    for (let j = i + 1; j < lessons.length; j++) {
      const a = lessons[i]!;
      const b = lessons[j]!;
      if (slotsOverlap({ day: a.day, start: a.start, end: a.end, room: '' }, { day: b.day, start: b.start, end: b.end, room: '' })) {
        count++;
      }
    }
  }
  return count;
}

type GroupLookup = Map<string, { name: string; lang: string; regularTeacherIds: Set<string> }>;

function buildGroupsLookup(rawGroups: OrgGroup[] | null): GroupLookup {
  return new Map(
    (rawGroups ?? []).map((g) => {
      const regularTeacherIds = new Set(
        (g.teachers ?? [])
          .filter((t) => mapTeacherRole(t.role) !== 'substitute')
          .map((t) => t.userId),
      );
      return [g.id, { name: g.name, lang: g.lang ?? '', regularTeacherIds }] as const;
    }),
  );
}

/**
 * Joins one teacher's raw projected lessons against the group lookup to
 * derive groupName/lang/isSubstitute, plus aggregate hours/pct/conflicts.
 * Shared by the school-wide composition and the single-teacher view.
 */
function composeTimetableTeacher(
  teacher: SchoolTeacher,
  entries: Array<{ day: TimetableTeacher['lessons'][number]['day']; start: string; end: string; groupId: string }>,
  groupsById: GroupLookup,
): TimetableTeacher {
  const lessons: TimetableTeacher['lessons'] = entries.map((e) => {
    const group = groupsById.get(e.groupId);
    return {
      day: e.day,
      start: e.start,
      end: e.end,
      groupId: e.groupId,
      groupName: group?.name ?? e.groupId,
      lang: group?.lang ?? '',
      isSubstitute: group ? !group.regularTeacherIds.has(teacher.userId) : false,
    };
  });

  const hours = lessons.reduce((acc, l) => acc + (timeToMinutes(l.end) - timeToMinutes(l.start)) / 60, 0);
  const max = teacher.maxWeeklyHours;
  const pct = max > 0 ? Math.round((hours / max) * 100) : 0;

  return {
    userId: teacher.userId,
    name: teacher.name,
    avatarUrl: teacher.avatarUrl,
    hours,
    max,
    pct,
    overloaded: hours > max,
    groups: new Set(lessons.map((l) => l.groupId)).size,
    conflicts: countConflicts(lessons),
    lessons,
  };
}

/**
 * Composes the rich TimetableTeacher[] view model from scheduling-service's
 * raw school-wide projection (one query, see SchedulingProvider.schoolTimetable)
 * joined against organization-service's teacher roster and group list.
 * Single source of truth for both the timetable page and getTeacherLoads.
 */
async function buildTimetableTeachers(schoolId: string): Promise<TimetableTeacher[]> {
  const scheduling = getSchedulingProvider();
  const [entries, teachers, rawGroups] = await Promise.all([
    scheduling.schoolTimetable(schoolId),
    getSchoolTeachers(schoolId),
    safeFetch<OrgGroup[]>(() => serverFetch({ service: 'organization', path: `/schools/${schoolId}/groups` })),
  ]);

  const groupsById = buildGroupsLookup(rawGroups);

  const entriesByTeacher = new Map<string, typeof entries>();
  for (const entry of entries) {
    if (!entriesByTeacher.has(entry.teacherId)) entriesByTeacher.set(entry.teacherId, []);
    entriesByTeacher.get(entry.teacherId)!.push(entry);
  }

  return teachers.map((t) => composeTimetableTeacher(t, entriesByTeacher.get(t.userId) ?? [], groupsById));
}

/**
 * A single teacher's own projected week (used by the teacher-facing
 * "my schedule" page) — one A.6 call instead of the school-wide query, so the
 * hot per-teacher path stays cheap regardless of school size.
 */
export type TeacherScheduleResult = { data: TimetableTeacher | null } | { error: string };

export async function getTeacherSchedule(
  schoolId: string,
  teacherId: string,
): Promise<TeacherScheduleResult> {
  try {
    const scheduling = getSchedulingProvider();
    const [entries, teachers, rawGroups] = await Promise.all([
      scheduling.teacherWeek(schoolId, teacherId),
      getSchoolTeachers(schoolId),
      safeFetch<OrgGroup[]>(() => serverFetch({ service: 'organization', path: `/schools/${schoolId}/groups` })),
    ]);

    const teacher = teachers.find((t) => t.userId === teacherId);
    if (!teacher) return { data: null };

    return { data: composeTimetableTeacher(teacher, entries, buildGroupsLookup(rawGroups)) };
  } catch (err) {
    if (err instanceof AppError && err.code === 'upstream_unavailable') {
      return { data: null };
    }
    console.error('[groups/queries] teacherWeek failed:', err);
    return { error: err instanceof Error ? err.message : 'Failed to load schedule' };
  }
}

/**
 * Teacher timetable view model for the timetable page.
 */
export type TimetableResult = { data: TimetableTeacher[] } | { error: string };

export async function getTimetable(schoolId: string): Promise<TimetableResult> {
  try {
    const data = await buildTimetableTeachers(schoolId);
    return { data };
  } catch (err) {
    if (err instanceof AppError && err.code === 'upstream_unavailable') {
      return { data: [] };
    }
    console.error('[groups/queries] schoolTimetable failed:', err);
    return { error: err instanceof Error ? err.message : 'Failed to load timetable' };
  }
}

/**
 * Teacher load summaries (used by assign-modal to show live load).
 */
export async function getTeacherLoads(
  schoolId: string,
): Promise<Record<string, ReturnType<typeof teacherLoad>>> {
  const timetableTeachers = await buildTimetableTeachers(schoolId).catch((err) => {
    console.error('[groups/queries] schoolTimetable failed:', err);
    return [] as TimetableTeacher[];
  });

  const result: Record<string, ReturnType<typeof teacherLoad>> = {};
  for (const tt of timetableTeachers) {
    result[tt.userId] = {
      hours: tt.hours,
      max: tt.max,
      pct: tt.pct,
      overloaded: tt.overloaded,
      groups: tt.groups,
      conflicts: tt.conflicts,
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
  availabilityStatus: TeacherAvailabilityStatus;
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

  // Derived availability (free/conflict/absent) against the group's committed
  // slots — the time-first source of truth; degrades to "free" on outage.
  const availability = await getSchedulingProvider()
    .teachersAvailability(schoolId, groupData.slots)
    .catch((err) => {
      if (!(err instanceof AppError && err.code === 'upstream_unavailable')) throw err;
      return [] as TeacherAvailability[];
    });
  const availabilityByTeacher = new Map(availability.map((a) => [a.teacherId, a]));

  const existingIds = new Set(groupData.teachers.map((t) => t.userId));

  const candidates: TeacherAssignCandidate[] = teachers.map((t) => {
    const tt = timetable.find((x: TimetableTeacher) => x.userId === t.userId);
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
      availabilityStatus: availabilityByTeacher.get(t.userId)?.status ?? 'free',
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
  const raw = await safeFetch<OrgMember[]>(() =>
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
    safeFetch<OrgMember[]>(() =>
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
