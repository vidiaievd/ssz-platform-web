import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { deriveStatus } from '@/lib/students/status';
import type {
  StudentListItem,
  StudentDetail,
  StudentGroupRef,
  StudentsListResult,
  Segment,
  SegmentKey,
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

  const [raw, serverClashes] = await Promise.all([
    safeStudentsFetch<RawStudentMember>(() =>
      serverFetch({
        service: 'organization',
        path: `/schools/${schoolId}/students/${userId}`,
      }),
    ),
    scheduling.studentClashes(schoolId, userId).catch(() => []),
  ]);

  if (!raw) return null;

  const clashes = serverClashes.map((w) => ({
    groupA: w.with ?? '',
    groupB: userId,
    day: w.day ?? '',
    time: w.time ?? '',
  }));

  const base = mapStudentListItem(raw, clashes);

  return {
    ...base,
    clashes,
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
