import 'server-only';

import { NextResponse } from 'next/server';

import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { serverFetch } from '@/lib/api/server-fetcher';
import { env } from '@/lib/env';
import { queueScopeFor, resolveOversightAccess, resolveReviewScope } from '@/features/review/lib/review-scope';
import { engineQueueView } from '@/features/review/lib/term-window';
import { getGroups } from '@/features/groups/api/queries';
import { buildCommandCenter } from '@/lib/scheduling/command-center';
import { groupsHealthWidget, teacherWorkloadWidget } from '@/features/dashboard/lib/operations-widgets';
import type { DashboardRole, GroupsHealthData, TeacherWorkloadData, WidgetData } from '@/features/dashboard/types';
import type {
  KpisPayload,
  AtRiskPayload,
  CourseHealthPayload,
  ActivityPayload,
  GroupGapsPayload,
  SchoolGroupFacts,
  SchoolSessionItem,
  Unavailable,
} from './types';

type WidgetResult<T> = T | Unavailable;

async function safeWidgetFetch<T>(fn: () => Promise<T>): Promise<WidgetResult<T>> {
  try {
    return await fn();
  } catch {
    return { status: 'unavailable' };
  }
}

export async function fetchDashboardKpis(schoolId: string): Promise<WidgetResult<KpisPayload>> {
  return safeWidgetFetch(() =>
    serverFetch<KpisPayload>({
      service: 'analytics',
      path: `/analytics/schools/${schoolId}/kpis`,
    }),
  );
}

/**
 * Every group of the school, taught against taken away — the gap widget (plan 58, §D).
 *
 * One call for the whole widget: the numbers are the group Progress tab's own, and asking
 * per row would make a school of twenty groups twenty round trips for one screen.
 */
export async function fetchGroupGaps(schoolId: string): Promise<WidgetResult<GroupGapsPayload>> {
  return safeWidgetFetch(() =>
    serverFetch<GroupGapsPayload>({
      service: 'analytics',
      path: `/analytics/schools/${schoolId}/group-gaps`,
    }),
  );
}

export async function fetchAtRisk(
  schoolId: string,
  limit = 3,
): Promise<WidgetResult<AtRiskPayload>> {
  return safeWidgetFetch(() =>
    serverFetch<AtRiskPayload>({
      service: 'analytics',
      path: `/analytics/schools/${schoolId}/at-risk`,
      query: { limit },
    }),
  );
}

export async function fetchCourseHealth(schoolId: string): Promise<WidgetResult<CourseHealthPayload>> {
  return safeWidgetFetch(() =>
    serverFetch<CourseHealthPayload>({
      service: 'analytics',
      path: `/analytics/schools/${schoolId}/courses/health`,
    }),
  );
}

export async function fetchActivity(
  schoolId: string,
  limit = 6,
  cursor?: string,
): Promise<WidgetResult<ActivityPayload>> {
  return safeWidgetFetch(() =>
    serverFetch<ActivityPayload>({
      service: 'analytics',
      path: `/analytics/schools/${schoolId}/activity`,
      query: { limit, ...(cursor ? { cursor } : {}) },
    }),
  );
}

/**
 * «Groups» card: the groups page's own reading (organization + scheduling), narrowed to the
 * viewer — a teacher gets the groups they teach today (OQ-108).
 */
export async function fetchGroupsHealth(
  schoolId: string,
  viewer: { role: DashboardRole; userId: string | null },
): Promise<WidgetData<GroupsHealthData>> {
  try {
    return groupsHealthWidget(await getGroups(schoolId), viewer);
  } catch {
    return { status: 'unavailable' };
  }
}

/** «Teacher workload» card: the teachers screen's composite (organization + scheduling, OQ-108). */
export async function fetchTeacherLoad(schoolId: string): Promise<WidgetData<TeacherWorkloadData>> {
  try {
    return teacherWorkloadWidget(await buildCommandCenter(schoolId));
  } catch {
    return { status: 'unavailable' };
  }
}

/**
 * The school's sessions on one day (`YYYY-MM-DD`) — «today's classes».
 *
 * scheduling-service already narrows a teacher to their own sessions, so the one call serves
 * the owner's view and the teacher's alike.
 */
export async function fetchSchoolSessionsOn(
  schoolId: string,
  day: string,
): Promise<WidgetResult<SchoolSessionItem[]>> {
  return safeWidgetFetch(() =>
    serverFetch<SchoolSessionItem[]>({
      service: 'scheduling',
      path: `/scheduling/schools/${schoolId}/sessions`,
      query: { from: day, to: day },
    }),
  );
}

/** organization-service's group summary — only the fields «today's classes» reads. */
type OrgGroupSummary = {
  id: string;
  name: string;
  studentCount?: number | null;
  capacityMax?: number | null;
};

/**
 * The school's groups as «today's classes» names them — from organization-service, the owner
 * of groups.
 * `max` 0 = no capacity set.
 */
export async function fetchSchoolGroupFacts(
  schoolId: string,
): Promise<WidgetResult<SchoolGroupFacts[]>> {
  return safeWidgetFetch(async () => {
    const groups = await serverFetch<OrgGroupSummary[]>({
      service: 'organization',
      path: `/schools/${schoolId}/groups`,
    });
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      studentCount: g.studentCount ?? 0,
      max: g.capacityMax ?? 0,
    }));
  });
}

/** One submission waiting for a teacher, as the dashboard's queue card lists it. */
export type WaitingWork = {
  id: string;
  /** Null when the directory does not know the learner yet. */
  who: string | null;
  /** The exercise as it read when it was handed in. */
  what: string | null;
  submittedAt: string;
  /** `read_aloud` is heard; everything else on the queue is read. */
  kind: 'pen' | 'mic';
};

export type WaitingWorkPayload = { pending: number; items: WaitingWork[] };

/** The engine's queue, only the fields the card reads (the full shape is in `app/api/review/queue`). */
interface EngineQueueForCard {
  summary: { pending: number };
  groups: {
    items: {
      attemptId: string;
      userId: string;
      templateCode: string;
      submittedAt: string;
      path: { exercise?: string | null } | null;
    }[];
  }[];
}

/**
 * The work waiting for review, as the dashboard's queue card shows it: the oldest few
 * submissions and how many wait in all.
 *
 * - `mine` — a teacher's own inbox, the scope «Перевірка» uses (`resolveReviewScope`: the
 *   groups they teach today). No groups is an empty queue, not an error.
 * - `school` — everything the school is waiting on, as «Нагляд перевірки» counts it
 *   (`resolveOversightAccess` + the engine's aggregate). The owner teaches no group, so their
 *   own inbox is empty by design and was the wrong source for their card.
 */
export async function fetchWaitingWork(
  school: string,
  whose: 'mine' | 'school',
  limit = 5,
): Promise<WidgetResult<WaitingWorkPayload>> {
  return safeWidgetFetch(async () => {
    let schoolId: string;
    let groupIds: string[];
    let pending: number | null = null;

    if (whose === 'mine') {
      const scope = await resolveReviewScope(school);
      if (scope instanceof NextResponse) throw new Error(`review scope refused: ${scope.status}`);
      const engineScope = queueScopeFor(scope, {});
      if (engineScope === null) return { pending: 0, items: [] };
      ({ schoolId, groupIds } = engineScope);
    } else {
      const access = await resolveOversightAccess(school);
      if (access instanceof NextResponse) throw new Error(`oversight refused: ${access.status}`);
      const aggregate = await serverFetch<{
        pending: { groupId: string | null; submittedAt: string[] }[];
      }>({
        service: 'exercises',
        path: '/internal/attempts/review/aggregate',
        method: 'POST',
        directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
        headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
        anonymous: true,
        body: { schoolId: access.schoolId, periodDays: 1 },
      });
      schoolId = access.schoolId;
      // Work handed in outside any group is counted; the queue lists by group, so it has no row.
      pending = aggregate.pending.reduce((n, bucket) => n + bucket.submittedAt.length, 0);
      groupIds = [
        ...new Set(aggregate.pending.map((b) => b.groupId).filter((id): id is string => id !== null)),
      ];
      if (groupIds.length === 0) return { pending, items: [] };
    }

    const queue = await serverFetch<EngineQueueForCard>({
      service: 'exercises',
      path: '/internal/attempts/review/queue',
      method: 'POST',
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      body: { schoolId, groupIds, ...engineQueueView('pending', new Date()), groupBy: 'student', limit },
    });

    const rows = queue.groups
      .flatMap((group) => group.items)
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
      .slice(0, limit);
    const people = await fetchProfileSummaries(rows.map((row) => row.userId)).catch(
      () => ({}) as Awaited<ReturnType<typeof fetchProfileSummaries>>,
    );

    return {
      pending: pending ?? queue.summary.pending,
      items: rows.map((row) => ({
        id: row.attemptId,
        who: people[row.userId]?.displayName ?? null,
        what: row.path?.exercise ?? null,
        submittedAt: row.submittedAt,
        kind: row.templateCode === 'read_aloud' ? 'mic' : 'pen',
      })),
    };
  });
}
