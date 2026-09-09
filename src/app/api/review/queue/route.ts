import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { env } from '@/lib/env';
import { hoursSince, isOverdue } from '@/features/review/lib/age-scale';
import { buildSlaMap } from '@/features/review/lib/sla-map';
import {
  fetchGroupNames,
  fetchQueueFacets,
  queueScopeFor,
  resolveReviewScope,
} from '@/features/review/lib/review-scope';
import {
  REVIEWABLE_EXERCISE_TYPES,
  type ReviewGroupBy,
  type ReviewQueueGroup,
  type ReviewQueueItem,
  type ReviewQueueResponse,
  type ReviewableExerciseType,
} from '@/features/review/types';

/** One snapshotted path — course, module and exercise as they read at submission time. */
interface EnginePath {
  course?: string | null;
  module?: string | null;
  exercise?: string | null;
}

/** The engine's answer, in its own vocabulary — ids, instants, no promises. */
interface EngineQueue {
  summary: { pending: number; oldestSubmittedAt: string | null };
  groups: {
    key: string;
    kind: ReviewGroupBy;
    exerciseId: string | null;
    containerId: string | null;
    path: EnginePath | null;
    count: number;
    submittedAt: string[];
    autoCleanIds: string[];
    items: {
      attemptId: string;
      userId: string;
      exerciseId: string;
      templateCode: string;
      groupId: string | null;
      containerId: string | null;
      path: EnginePath | null;
      submittedAt: string;
      attemptNo: number;
      autoClean: boolean;
      lock: { teacherId: string; expiresAt: string } | null;
    }[];
  }[];
  nextCursor: string | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const EMPTY_SUMMARY = {
  pending: 0,
  overdue: 0,
  overduePartial: false,
  oldestHours: null,
} as const;

/**
 * Everything waiting on this teacher, across every group and course they hold.
 *
 * Four services answer four different parts of one screen, and the order below is the
 * authorisation. organization-service says which groups are this person's *today*, and
 * only those ids reach exercise-engine — the engine authorises nothing at all, so a scope
 * it is handed is a scope it will serve. Promises come from the school and its courses,
 * never from the engine (plan 44 §0.1), which is what keeps one formula for urgency across
 * the product. Names come last, from the directory, and their absence costs a name rather
 * than the queue.
 *
 * Ages are computed here rather than upstream: hours counted at the database are already
 * stale by the time they are painted, and every screen in this subsystem colours by them.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const school = searchParams.get('school');
  if (!school) {
    return NextResponse.json({ error: 'school is required' }, { status: 400 });
  }

  const scope = await resolveReviewScope(school);
  if (scope instanceof NextResponse) return scope;

  const groupBy: ReviewGroupBy = searchParams.get('groupBy') === 'student' ? 'student' : 'exercise';
  const overdueOnly = searchParams.get('overdue') === 'true';
  const typeParam = searchParams.get('type');
  const type = REVIEWABLE_EXERCISE_TYPES.includes(typeParam as ReviewableExerciseType)
    ? (typeParam as ReviewableExerciseType)
    : null;

  const engineScope = queueScopeFor(scope, {
    group: searchParams.get('group'),
    course: searchParams.get('course'),
    type,
  });

  // A teacher between assignments, or a filter naming a group they do not teach. Both are
  // an empty inbox and neither is a refusal (`resolveReviewScope` explains why). The
  // filter options still travel, or a filter that emptied the queue could not be undone.
  if (engineScope === null) {
    const facets: ReviewQueueResponse = {
      summary: { ...EMPTY_SUMMARY },
      facets: await fetchQueueFacets(scope),
      groups: [],
      nextCursor: null,
    };
    return NextResponse.json(facets);
  }

  const limit = Math.min(Number(searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT);
  const cursor = searchParams.get('cursor');

  let queue: EngineQueue;
  try {
    queue = await serverFetch<EngineQueue>({
      service: 'exercises',
      path: '/internal/attempts/review/queue',
      method: 'POST',
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      body: { ...engineScope, groupBy, limit, ...(cursor ? { cursor } : {}) },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch the review queue' }, { status: 502 });
  }

  const now = new Date();
  const items = queue.groups.flatMap((group) => group.items);

  const [sla, people, groupNames, facets] = await Promise.all([
    buildSlaMap(
      scope.schoolId,
      queue.groups.flatMap((group) => [
        ...(group.containerId ? [group.containerId] : []),
        ...group.items.map((item) => item.containerId).filter((id): id is string => id !== null),
      ]),
    ),
    // The colleague holding a marker is a person too, and their name is on the row — so
    // both sets of ids travel in one lookup.
    fetchProfileSummaries([
      ...items.map((item) => item.userId),
      ...items.map((item) => item.lock?.teacherId).filter((id): id is string => Boolean(id)),
    ]),
    fetchGroupNames(scope.schoolId),
    fetchQueueFacets(scope),
  ]);

  let overdueSeen = 0;
  const groups: ReviewQueueGroup[] = [];

  for (const group of queue.groups) {
    // The promise is the group's, not the request's: a queue crosses courses and each may
    // have set its own (`API_CONTRACT.md` §1).
    const slaHours = sla.slaFor(group.containerId ?? group.items[0]?.containerId ?? null);

    const rows: ReviewQueueItem[] = [];
    for (const item of group.items) {
      const ageHours = hoursSince(item.submittedAt, now);
      const late = slaHours === null ? false : isOverdue(ageHours, slaHours);
      if (late) overdueSeen += 1;
      if (overdueOnly && !late) continue;

      rows.push({
        id: item.attemptId,
        student: {
          id: item.userId,
          name: people[item.userId]?.displayName ?? null,
          groupName: item.groupId ? (groupNames[item.groupId] ?? null) : null,
        },
        exerciseId: item.exerciseId,
        exerciseTitle: item.path?.exercise ?? null,
        submittedAt: item.submittedAt,
        ageHours,
        overdue: late,
        attemptNo: item.attemptNo,
        autoClean: item.autoClean,
        lock: item.lock
          ? {
              teacherId: item.lock.teacherId,
              teacherName: people[item.lock.teacherId]?.displayName ?? null,
              expiresAt: item.lock.expiresAt,
            }
          : null,
      });
    }

    // A group emptied by the filter is not a heading with nothing under it.
    if (rows.length === 0) continue;

    const kept = new Set(rows.map((row) => row.id));
    groups.push({
      key: group.key,
      kind: group.kind,
      title:
        group.kind === 'exercise'
          ? (group.path?.exercise ?? null)
          : (people[group.key]?.displayName ?? null),
      path:
        group.kind === 'exercise'
          ? {
              course: group.path?.course ?? null,
              lesson: group.path?.module ?? null,
              type: group.items[0]?.templateCode ?? null,
            }
          : null,
      slaHours,
      count: rows.length,
      // Ages of the rows shown: a histogram over submissions the filter removed would
      // describe a list nobody is looking at.
      ages: rows.map((row) => row.ageHours),
      overdue: rows.filter((row) => row.overdue).length,
      autoCleanIds: group.autoCleanIds.filter((id) => kept.has(id)),
      items: rows,
    });
  }

  const oldest = queue.summary.oldestSubmittedAt;

  const body: ReviewQueueResponse = {
    summary: {
      pending: queue.summary.pending,
      overdue: overdueSeen,
      // Lateness needs a promise, and a promise needs the course each submission belongs
      // to — which only the loaded page carries. The header reads "9+" rather than "9"
      // when this is set, instead of quoting a page's number as the whole queue's.
      overduePartial: queue.nextCursor !== null,
      oldestHours: oldest === null ? null : hoursSince(oldest, now),
    },
    facets,
    groups,
    nextCursor: queue.nextCursor,
  };

  return NextResponse.json(body);
}
