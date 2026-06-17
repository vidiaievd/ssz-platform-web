import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { AppError } from '@/lib/errors';
import { deriveStatus } from '@/lib/students/status';
import type {
  StudentListItem,
  StudentDetail,
  StudentGroupRef,
  StudentsListResult,
  Segment,
  SegmentKey,
  StudentInSchool,
  MembershipDetail,
  LevelEntry,
  MembershipRole,
  MembershipStatus,
  GroupStatus,
  TeacherRef,
  Slot,
} from '@/features/students/types';
import type { CEFR, LangCode } from '@/features/groups/types';
import { SEGMENT_KEYS } from '@/lib/students/status';

// ── Raw backend shapes ────────────────────────────────────────────────────────

type RawStudentMember = {
  userId: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  lang?: string;
  level?: string;
  progress?: number;
  lastSeen?: string | null;
  enrolledAt?: string;
  groups?: Array<{
    id: string;
    name: string;
    lang?: string;
    level?: string;
    scheduleSummary?: string;
    teachers?: Array<{
      userId: string;
      name?: string;
      avatarUrl?: string | null;
      role?: string;
    }>;
  }>;
};

async function safeStudentsFetch<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function mapTeacherRole(r?: string): 'primary' | 'co-primary' | 'substitute' {
  if (r === 'CO_PRIMARY' || r === 'co-primary') return 'co-primary';
  if (r === 'SUBSTITUTE' || r === 'substitute') return 'substitute';
  return 'primary';
}

function mapGroupRef(g: NonNullable<RawStudentMember['groups']>[number]): StudentGroupRef {
  return {
    id: g.id,
    name: g.name,
    lang: (g.lang ?? 'en') as LangCode,
    level: (g.level ?? 'A1') as CEFR,
    scheduleSummary: g.scheduleSummary,
    teachers: (g.teachers ?? []).map((t) => ({
      userId: t.userId,
      name: t.name ?? '',
      avatarUrl: t.avatarUrl ?? null,
      role: mapTeacherRole(t.role),
    })),
  };
}

function mapStudentListItem(
  raw: RawStudentMember,
  clashes: Array<{ groupA: string; groupB: string; day: string; time: string }>,
): StudentListItem {
  const groups = (raw.groups ?? []).map(mapGroupRef);
  const enrolledAt = raw.enrolledAt ?? new Date().toISOString().slice(0, 10);
  const status = deriveStatus({
    groups,
    clashes,
    progress: raw.progress ?? 0,
    lastSeen: raw.lastSeen ?? null,
    enrolledAt,
  });

  return {
    userId: raw.userId,
    name: raw.name ?? '',
    email: raw.email ?? '',
    avatarUrl: raw.avatarUrl ?? null,
    lang: (raw.lang ?? 'en') as LangCode,
    level: (raw.level ?? 'A1') as CEFR,
    status,
    groups,
    progress: raw.progress ?? 0,
    lastSeen: raw.lastSeen ?? null,
    enrolledAt,
  };
}

// ── Public fetchers ───────────────────────────────────────────────────────────

export async function getStudents(
  schoolId: string,
  opts: { segment?: SegmentKey; search?: string; cursor?: string } = {},
): Promise<StudentsListResult> {
  const scheduling = getSchedulingProvider();

  const query: Record<string, string> = {};
  if (opts.search) query.search = opts.search;
  if (opts.cursor) query.cursor = opts.cursor;

  const [raw, studentClashMap] = await Promise.all([
    safeStudentsFetch<{ items?: RawStudentMember[]; total?: number; nextCursor?: string } | RawStudentMember[]>(
      () =>
        serverFetch({
          service: 'organization',
          path: `/schools/${schoolId}/students`,
          query,
        }),
    ),
    // Fetch clashes per school from scheduling provider; falls back to empty map
    (async () => {
      const map: Record<string, Array<{ groupA: string; groupB: string; day: string; time: string }>> = {};
      try {
        const conflicts = await scheduling.teacherConflicts(schoolId);
        // teacher conflicts are different — student clashes are per-user
        // For now we return empty map; real impl will call scheduling.studentClashes per user
        void conflicts;
      } catch {
        // scheduling not available — degraded gracefully
      }
      return map;
    })(),
  ]);

  if (!raw) return { items: [], total: 0 };

  const rawItems = Array.isArray(raw) ? raw : (raw.items ?? []);
  const total = Array.isArray(raw) ? rawItems.length : (raw.total ?? rawItems.length);
  const nextCursor = Array.isArray(raw) ? undefined : raw.nextCursor;

  const items = rawItems.map((r) => mapStudentListItem(r, studentClashMap[r.userId] ?? []));

  // Apply segment predicate client-side (server filter comes first via ?segment= when backend supports it)
  const { segmentPredicate } = await import('@/lib/students/status');
  const predicate = opts.segment && opts.segment !== 'all'
    ? segmentPredicate(opts.segment)
    : null;

  const filtered = predicate ? items.filter(predicate) : items;

  return { items: filtered, total, nextCursor };
}

export async function getStudent(
  schoolId: string,
  userId: string,
): Promise<StudentDetail | null> {
  const scheduling = getSchedulingProvider();

  const [raw, clashesResult] = await Promise.all([
    safeStudentsFetch<RawStudentMember>(() =>
      serverFetch({
        service: 'organization',
        path: `/schools/${schoolId}/students/${userId}`,
      }),
    ),
    scheduling.studentClashes(schoolId, userId).then(
      (data) => ({ data }),
      (err: unknown) => {
        if (err instanceof AppError && err.code === 'upstream_unavailable') {
          return { data: [] };
        }
        console.error('[students/queries] studentClashes failed:', err);
        return { error: err instanceof Error ? err.message : 'Failed to load schedule conflicts' };
      },
    ),
  ]);

  if (!raw) return null;

  const clashes = 'data' in clashesResult
    ? (clashesResult.data ?? []).map((w) => ({
        groupA: w.with ?? '',
        groupB: userId,
        day: w.day ?? '',
        time: w.time ?? '',
      }))
    : [];

  const base = mapStudentListItem(raw, clashes);

  return {
    ...base,
    clashes,
    ...('error' in clashesResult && { clashesError: clashesResult.error }),
  };
}

// ── Groups (for enroll dialog picker) ────────────────────────────────────────

export type GroupSelectOption = { id: string; name: string; lang: string; level: string };

export async function getGroupsForSelect(schoolId: string): Promise<GroupSelectOption[]> {
  try {
    const raw = await serverFetch<Array<{ id: string; name: string; lang?: string; level?: string }>>({
      service: 'organization',
      path: `/schools/${schoolId}/groups`,
    });
    return raw.map((g) => ({ id: g.id, name: g.name, lang: g.lang ?? '', level: g.level ?? '' }));
  } catch {
    return [];
  }
}

// ── Raw membership + history shapes ──────────────────────────────────────────

type RawMembership = {
  id?: string;
  groupId: string;
  groupName?: string;
  lang?: string;
  level?: string;
  role?: string;
  status?: string;
  addedAt?: string;
  exitedAt?: string;
  groupStatus?: string;
  teachers?: Array<{
    userId: string;
    name?: string;
    avatarUrl?: string | null;
    role?: string;
  }>;
  schedule?: Array<{ day: string; time: string; durationMin?: number }>;
};

type RawLevelEntry = {
  level?: string;
  startedAt?: string;
  endedAt?: string;
  groupId?: string;
  groupName?: string;
  assessedBy?: { userId: string; name?: string; avatarUrl?: string | null; role?: string };
};

function mapMembershipRole(r?: string): MembershipRole {
  if (r === 'trial') return 'trial';
  if (r === 'observer') return 'observer';
  return 'student';
}

function mapMembershipStatus(s?: string): MembershipStatus {
  if (s === 'past' || s === 'archived' || s === 'exited') return 'past';
  return 'active';
}

function mapGroupStatus(s?: string): GroupStatus {
  if (s === 'archived') return 'archived';
  if (s === 'draft') return 'draft';
  return 'active';
}

function mapSlots(raw?: Array<{ day: string; time: string; durationMin?: number }>): Slot[] {
  return (raw ?? []).map((s) => ({ day: s.day, time: s.time, durationMin: s.durationMin }));
}

function mapTeacherRef(t: { userId: string; name?: string; avatarUrl?: string | null; role?: string }): TeacherRef {
  return {
    userId: t.userId,
    name: t.name ?? '',
    avatarUrl: t.avatarUrl ?? null,
    role: mapTeacherRole(t.role),
  };
}

function mapMembership(raw: RawMembership): MembershipDetail {
  return {
    id: raw.id ?? raw.groupId,
    groupId: raw.groupId,
    groupName: raw.groupName ?? '',
    lang: (raw.lang ?? 'en') as LangCode,
    level: (raw.level ?? 'A1') as CEFR,
    role: mapMembershipRole(raw.role),
    status: mapMembershipStatus(raw.status),
    addedAt: raw.addedAt ?? new Date().toISOString().slice(0, 10),
    exitedAt: raw.exitedAt,
    teachers: (raw.teachers ?? []).map(mapTeacherRef),
    schedule: mapSlots(raw.schedule),
    groupStatus: mapGroupStatus(raw.groupStatus),
  };
}

function mapLevelEntry(raw: RawLevelEntry): LevelEntry {
  return {
    level: (raw.level ?? 'A1') as CEFR,
    startedAt: raw.startedAt ?? new Date().toISOString().slice(0, 10),
    endedAt: raw.endedAt,
    groupId: raw.groupId,
    groupName: raw.groupName,
    assessedBy: raw.assessedBy ? mapTeacherRef(raw.assessedBy) : undefined,
  };
}

/** Derives memberships from flat groups when the /memberships endpoint is unavailable. */
function deriveMembershipsFromGroups(groups: StudentGroupRef[]): MembershipDetail[] {
  return groups.map((g) => ({
    id: g.id,
    groupId: g.id,
    groupName: g.name,
    lang: g.lang,
    level: g.level,
    role: 'student' as MembershipRole,
    status: 'active' as MembershipStatus,
    addedAt: new Date().toISOString().slice(0, 10),
    teachers: (g.teachers ?? []).map((t) => ({
      userId: t.userId,
      name: t.name,
      avatarUrl: t.avatarUrl ?? null,
      role: t.role,
    })),
    schedule: g.scheduleSummary
      ? [{ day: g.scheduleSummary, time: '' }]
      : [],
    groupStatus: 'active' as GroupStatus,
  }));
}

/**
 * Fetches the enriched StudentInSchool for the detail page.
 * Tries `/memberships` and `/history` endpoints; falls back to deriving from
 * the base student response if those endpoints are not yet available.
 */
export async function getStudentInSchool(
  schoolId: string,
  userId: string,
): Promise<StudentInSchool | null> {
  const scheduling = getSchedulingProvider();

  const [rawStudent, membershipsResult, historyResult, clashesResult] = await Promise.allSettled([
    serverFetch<RawStudentMember>({
      service: 'organization',
      path: `/schools/${schoolId}/students/${userId}`,
    }),
    serverFetch<RawMembership[]>({
      service: 'organization',
      path: `/schools/${schoolId}/students/${userId}/memberships`,
    }),
    serverFetch<RawLevelEntry[]>({
      service: 'organization',
      path: `/schools/${schoolId}/students/${userId}/history`,
    }),
    scheduling.studentClashes(schoolId, userId).then(
      (data) => ({ data }),
      (err: unknown) => {
        if (err instanceof AppError && err.code === 'upstream_unavailable') return { data: [] };
        return { error: err instanceof Error ? err.message : 'Failed to load clashes' };
      },
    ),
  ]);

  if (rawStudent.status === 'rejected') return null;
  const raw = rawStudent.value;
  if (!raw) return null;

  const groups = (raw.groups ?? []).map(mapGroupRef);
  const enrolledAt = raw.enrolledAt ?? new Date().toISOString().slice(0, 10);

  const clashData = clashesResult.status === 'fulfilled' ? clashesResult.value : { data: [] };
  const clashes = 'data' in clashData
    ? (clashData.data ?? []).map((w) => ({
        groupA: w.with ?? '',
        groupAId: '',
        groupB: userId,
        groupBId: '',
        day: w.day ?? '',
        time: w.time ?? '',
      }))
    : [];

  const status = deriveStatus({
    groups,
    clashes,
    progress: raw.progress ?? 0,
    lastSeen: raw.lastSeen ?? null,
    enrolledAt,
  });

  // Memberships: try dedicated endpoint, fall back to deriving from groups
  const memberships: MembershipDetail[] =
    membershipsResult.status === 'fulfilled' && Array.isArray(membershipsResult.value)
      ? membershipsResult.value.map(mapMembership)
      : deriveMembershipsFromGroups(groups);

  const levelHistory: LevelEntry[] =
    historyResult.status === 'fulfilled' && Array.isArray(historyResult.value)
      ? historyResult.value.map(mapLevelEntry)
      : [];

  const activeMemberships = memberships.filter((m) => m.status === 'active');
  const teacherIds = [
    ...new Set(activeMemberships.flatMap((m) => m.teachers.map((t) => t.userId))),
  ];

  return {
    id: raw.userId,
    name: raw.name ?? '',
    email: raw.email ?? '',
    avatarUrl: raw.avatarUrl ?? null,
    status,
    addedToSchoolAt: enrolledAt,
    primaryLanguage: (raw.lang ?? 'en') as LangCode,
    currentLevel: (raw.level ?? 'A1') as CEFR,
    progress: Math.round((raw.progress ?? 0) * 100),
    lastActiveAt: raw.lastSeen ?? null,
    memberships,
    levelHistory,
    teacherIds,
    clashes,
    ...('error' in clashData && { clashesError: clashData.error }),
  };
}

export async function getSegments(schoolId: string): Promise<Segment[]> {
  // Behind a feature flag until backend §2.4 is ready.
  // Returns built-in segments derived from predicate keys.
  const { segmentPredicate } = await import('@/lib/students/status');

  // Try to get counts from a full list (no segment filter)
  const allStudents = await safeStudentsFetch<StudentsListResult>(() =>
    getStudents(schoolId),
  );
  const items = allStudents?.items ?? [];

  return SEGMENT_KEYS.map((key) => {
    const pred = segmentPredicate(key);
    return {
      id: key,
      name: key,
      key,
      predicate: {},
      count: items.filter(pred).length,
    } satisfies Segment;
  });
}
