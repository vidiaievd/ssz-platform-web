import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { env } from '@/lib/env';
import { hoursSince, isOverdue } from '@/features/review/lib/age-scale';
import { buildSlaMap, type SlaMap } from '@/features/review/lib/sla-map';
import { fetchGroupNames, resolveOversightAccess } from '@/features/review/lib/review-scope';
import {
  durationsByReviewer,
  median,
  sharesLoad,
  tallyLoad,
  tallySchool,
  type PendingBucket,
  type ReviewedBucket,
} from '@/features/review/lib/oversight';
import {
  OVERSIGHT_PERIODS,
  type OversightCourse,
  type OversightGroup,
  type OversightPeriod,
  type OversightStuck,
  type OversightTeacher,
  type OversightTermTally,
  type ReviewOversightResponse,
} from '@/features/review/types/oversight';

/** The engine's picture of the load: times and ids, no promises and no names. */
interface EngineAggregate {
  since: string | null;
  pending: { containerId: string | null; groupId: string | null; submittedAt: string[] }[];
  reviewed: {
    reviewerId: string;
    containerId: string | null;
    groupId: string | null;
    durationsHours: number[];
  }[];
  unassigned: { attemptId: string; userId: string; exerciseId: string; submittedAt: string }[];
  truncated: boolean;
}

/** Who may review each group, as organization-service alone can say. */
interface EngineReviewers {
  groups: { groupId: string; teachers: { userId: string; name: string; role: string }[] }[];
}

/** analytics' reading of the auto-acceptance journal (plan 80, step 6b). */
interface AnalyticsTerms extends OversightTermTally {
  unattributed: number | null;
  teachers: (OversightTermTally & { userId: string; name: string })[] | null;
}

/** One page of the school's queue — where the named rows of "stuck" come from. */
interface EngineQueueItem {
  attemptId: string;
  userId: string;
  groupId: string | null;
  containerId: string | null;
  path: { course?: string | null; exercise?: string | null } | null;
  submittedAt: string;
}

/** How many named rows the "stuck" list carries. Beyond this it stops being a list. */
const STUCK_LIMIT = 25;

/**
 * How much of the school's queue is read to find those rows, oldest group first.
 *
 * Capped at the engine's own ceiling on `limit` (`ReviewQueueRequestDto`, `@Max(100)`):
 * anything higher 400s there, and the caught error silently emptied this whole section —
 * "Not moving" read as "nothing is late" instead of "the read failed" (found 30.08).
 */
const STUCK_SCAN = 100;

/**
 * The screen is opened about once a week and costs four services; a minute of staleness
 * costs nothing at all. Keyed by caller as well as school and period, because what a
 * MANAGER may see is settled before this cache is consulted and must not be handed on.
 */
const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { at: number; body: ReviewOversightResponse }>();

function cached(key: string): ReviewOversightResponse | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.body;
}

function remember(key: string, body: ReviewOversightResponse): void {
  // The map is bounded by wiping it wholesale rather than by eviction: entries live sixty
  // seconds, so a school that stops being asked about would otherwise linger for nothing.
  if (cache.size > 200) cache.clear();
  cache.set(key, { at: Date.now(), body });
}

/**
 * The shape of a school's review load, in one answer (`API_CONTRACT.md` §6).
 *
 * Six sources, one screen. exercise-engine reports *when* things were handed in and
 * answered; organization-service says who reviews which group and what the school
 * promised; content-service says which courses promised something else; analytics keeps
 * the journal of work a model's verdict closed at the term (plan 80); the directory
 * supplies the names. The composition is the whole point — every figure on this screen
 * depends on at least two of them, and a browser asking each in turn would be authorised
 * by none.
 *
 * Two counts of the same queue live side by side here, deliberately. The school's summary
 * counts every waiting submission once; the teacher rows count a group with two reviewers
 * in both their queues, because that is what each of them actually has to read (plan 46
 * §46.1). `shared` marks the rows where the two readings differ, and the screen says so
 * rather than leaving an administrator to reconcile them.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const school = searchParams.get('school');
  if (!school) {
    return NextResponse.json({ error: 'school is required' }, { status: 400 });
  }

  const access = await resolveOversightAccess(school);
  if (access instanceof NextResponse) return access;

  const periodDays = readPeriod(searchParams.get('period'));

  const key = `${access.userId}|${access.schoolId}|${periodDays}`;
  const hit = cached(key);
  if (hit) return NextResponse.json(hit);

  let aggregate: EngineAggregate;
  try {
    aggregate = await serverFetch<EngineAggregate>({
      service: 'exercises',
      path: '/internal/attempts/review/aggregate',
      method: 'POST',
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      body: { schoolId: access.schoolId, periodDays },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to read the review load' }, { status: 502 });
  }

  const now = new Date();

  // Ages, not instants, from here on: every figure below is measured in hours waited, and
  // hours counted at the database are already stale by the time they are painted.
  const pending: PendingBucket[] = aggregate.pending.map((bucket) => ({
    containerId: bucket.containerId,
    groupId: bucket.groupId,
    ages: bucket.submittedAt.map((at) => hoursSince(at, now)),
  }));
  const reviewed: ReviewedBucket[] = aggregate.reviewed;

  const containerIds = [
    ...new Set(
      [...pending, ...reviewed]
        .map((bucket) => bucket.containerId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const groupIds = [
    ...new Set(pending.map((bucket) => bucket.groupId).filter((id): id is string => id !== null)),
  ];

  const [sla, groupNames, courseTitles, journal] = await Promise.all([
    buildSlaMap(access.schoolId, containerIds),
    fetchGroupNames(access.schoolId),
    fetchCourseTitles(containerIds),
    fetchTerms(access.schoolId, periodDays, now),
  ]);

  // Every group's staff, not only the groups with work waiting: under a model-first policy
  // the term empties queues by itself, so the teacher it is happening to may have nothing
  // left waiting — and a helper for them needs their groups all the same (plan 80, step 7d).
  const reviewers = await fetchReviewers([...new Set([...groupIds, ...Object.keys(groupNames)])]);

  const teachersByGroup = new Map(reviewers.groups.map((group) => [group.groupId, group.teachers]));
  const reviewersOf = (bucket: PendingBucket): string[] =>
    (bucket.groupId === null ? [] : (teachersByGroup.get(bucket.groupId) ?? [])).map(
      (teacher) => teacher.userId,
    );

  const slaFor = (containerId: string | null) => sla.slaFor(containerId);

  const school_ = tallySchool(pending, slaFor);
  const byTeacher = tallyLoad(pending, reviewersOf, slaFor);
  const byGroup = tallyLoad(pending, (bucket) => (bucket.groupId ? [bucket.groupId] : []), slaFor);
  const byCourse = tallyLoad(
    pending,
    (bucket) => (bucket.containerId ? [bucket.containerId] : []),
    slaFor,
  );

  const durations = durationsByReviewer(reviewed);

  // Names for everyone who appears: the reviewers organization-service named come with
  // theirs already, so only the ones it could not name are asked for.
  const teacherNames = new Map<string, string>();
  for (const group of reviewers.groups) {
    for (const teacher of group.teachers) teacherNames.set(teacher.userId, teacher.name);
  }

  const stuck = await buildStuck({
    schoolId: access.schoolId,
    groupIds,
    pendingUnassigned: aggregate.unassigned,
    sla,
    now,
    groupNames,
    teachersByGroup,
  });

  // Whose work the term closed. A teacher with nothing waiting still gets a row when it did:
  // an empty queue emptied by the term is the case this column exists to show.
  const termsByTeacher = new Map(
    (journal?.teachers ?? [])
      .filter((teacher) => teacher.accepted > 0)
      .map((teacher) => [teacher.userId, teacher] as const),
  );
  for (const [id, teacher] of termsByTeacher) {
    if (!teacherNames.has(id) && teacher.name) teacherNames.set(id, teacher.name);
  }

  const teacherIds = [...new Set([...byTeacher.keys(), ...termsByTeacher.keys()])];

  const teachers: OversightTeacher[] = teacherIds
    .map((id) => {
      const tally = byTeacher.get(id) ?? { pending: 0, overdue: 0, ages: [] };
      const held = [...teachersByGroup.entries()]
        .filter(([, list]) => list.some((teacher) => teacher.userId === id))
        .map(([groupId]) => ({ id: groupId, name: groupNames[groupId] }))
        .filter((group): group is { id: string; name: string } => Boolean(group.name))
        .sort((a, b) => a.name.localeCompare(b.name));
      const term = termsByTeacher.get(id);

      return {
        id,
        name: teacherNames.get(id) ?? null,
        groups: held.map((group) => group.name),
        groupIds: held.map((group) => group.id),
        pending: tally.pending,
        overdue: tally.overdue,
        ages: tally.ages,
        medianHours: median(durations.get(id) ?? []),
        shared: sharesLoad(pending, reviewersOf, id),
        terms: term
          ? { accepted: term.accepted, revised: term.revised, overturned: term.overturned }
          : null,
      };
    })
    // Busiest first: the screen exists to find where it has piled up, and a row's place
    // in the list is the first answer it gives. Work the term closed is load that was not
    // carried, so it ranks next.
    .sort(
      (a, b) =>
        b.pending - a.pending ||
        (b.terms?.accepted ?? 0) - (a.terms?.accepted ?? 0) ||
        (b.medianHours ?? 0) - (a.medianHours ?? 0),
    );

  const groups: OversightGroup[] = [...byGroup.entries()]
    .map(([id, tally]) => ({
      id,
      name: groupNames[id] ?? null,
      pending: tally.pending,
      overdue: tally.overdue,
      ages: tally.ages,
    }))
    .sort((a, b) => b.pending - a.pending);

  const courses: OversightCourse[] = [...byCourse.entries()]
    .map(([id, tally]) => ({
      id,
      name: courseTitles[id] ?? null,
      slaHours: sla.slaFor(id),
      overridden: id in sla.byCourse,
      pending: tally.pending,
      overdue: tally.overdue,
      ages: tally.ages,
    }))
    .sort((a, b) => b.pending - a.pending);

  const body: ReviewOversightResponse = {
    // The id, not the slug the caller asked with: the screen's assignment dialog posts to
    // routes that take ids, and resolving it a second time in the browser would be a round
    // trip for something this answer already knows.
    schoolId: access.schoolId,
    since: aggregate.since,
    periodDays,
    schoolSlaHours: sla.schoolHours,
    truncated: aggregate.truncated,
    summary: {
      pending: school_.pending,
      overdue: school_.overdue,
      oldestHours: school_.ages.length === 0 ? null : Math.max(...school_.ages),
      medianHours: median([...durations.values()].flat()),
    },
    ages: school_.ages,
    teachers,
    groups,
    courses,
    stuck,
    terms:
      journal === null
        ? null
        : {
            accepted: journal.accepted,
            revised: journal.revised,
            overturned: journal.overturned,
            unattributed: journal.unattributed,
            attributed: journal.teachers !== null,
          },
  };

  remember(key, body);
  return NextResponse.json(body);
}

/** 7, 30 or 90 — anything else is the middle one rather than an error. */
function readPeriod(raw: string | null): OversightPeriod {
  const value = Number(raw);
  return OVERSIGHT_PERIODS.includes(value as OversightPeriod) ? (value as OversightPeriod) : 30;
}

async function fetchReviewers(groupIds: string[]): Promise<EngineReviewers> {
  if (groupIds.length === 0) return { groups: [] };

  try {
    return await serverFetch<EngineReviewers>({
      service: 'organization',
      path: '/internal/review/reviewers',
      method: 'POST',
      directBaseUrl: env.ORGANIZATION_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      body: { groupIds, at: new Date().toISOString() },
    });
  } catch {
    // The load is still true without it; only the attribution to people is lost, and the
    // screen shows the groups and courses it could attribute.
    return { groups: [] };
  }
}

/**
 * The auto-acceptance journal over the screen's period: the days the terms ran out, UTC,
 * today included — so seven days is today and the six before it.
 *
 * Null when analytics could not be asked. The rest of the screen does not depend on it, and
 * a zero here would claim that no work was closed by the term.
 */
async function fetchTerms(
  schoolId: string,
  periodDays: OversightPeriod,
  now: Date,
): Promise<AnalyticsTerms | null> {
  if (!env.ANALYTICS_SERVICE_INTERNAL_URL || !env.INTERNAL_SERVICE_TOKEN) return null;

  const day = (date: Date) => date.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - (periodDays - 1) * 86_400_000);

  try {
    return await serverFetch<AnalyticsTerms>({
      service: 'analytics',
      path: `/internal/review-terms/schools/${schoolId}`,
      directBaseUrl: env.ANALYTICS_SERVICE_INTERNAL_URL,
      query: { from: day(from), to: day(now) },
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN },
      anonymous: true,
    });
  } catch {
    return null;
  }
}

async function fetchCourseTitles(ids: string[]): Promise<Record<string, string>> {
  const titles = await Promise.all(
    ids.map(async (id) => {
      try {
        const container = await serverFetch<{ title?: string }>({
          service: 'content',
          path: `/containers/${id}`,
        });
        return [id, container.title ?? ''] as const;
      } catch {
        return [id, ''] as const;
      }
    }),
  );

  return Object.fromEntries(titles.filter(([, title]) => title !== ''));
}

/**
 * The named list of work that has been waiting longer than promised.
 *
 * The aggregate cannot supply it: it reports the *shape* of what is waiting, in times
 * grouped by course and group, and a row on this list needs a learner, an exercise and an
 * attempt id to act on. So the school's queue is read once, oldest first, and the late
 * ones are kept — plus the submissions the aggregate already names individually, the ones
 * whose learner was in no group at all and which therefore appear in no queue.
 */
async function buildStuck(input: {
  schoolId: string;
  groupIds: string[];
  pendingUnassigned: EngineAggregate['unassigned'];
  sla: SlaMap;
  now: Date;
  groupNames: Record<string, string>;
  teachersByGroup: Map<string, { userId: string; name: string; role: string }[]>;
}): Promise<OversightStuck[]> {
  const { schoolId, groupIds, pendingUnassigned, sla, now, groupNames, teachersByGroup } = input;

  const assigned = groupIds.length === 0 ? [] : await fetchSchoolQueue(schoolId, groupIds);

  const rows: OversightStuck[] = [];

  for (const item of assigned) {
    const slaHours = sla.slaFor(item.containerId);
    const hours = hoursSince(item.submittedAt, now);
    if (slaHours === null || !isOverdue(hours, slaHours)) continue;

    const teachers = item.groupId ? (teachersByGroup.get(item.groupId) ?? []) : [];

    rows.push({
      id: item.attemptId,
      studentId: item.userId,
      studentName: null,
      exerciseTitle: item.path?.exercise ?? null,
      groupId: item.groupId,
      groupName: item.groupId ? (groupNames[item.groupId] ?? null) : null,
      // The lead teacher answers for the group; a co-reviewer's name beside it would
      // make the row about who to blame rather than about what to do next.
      teacherName:
        (teachers.find((teacher) => teacher.role === 'primary') ?? teachers[0])?.name ?? null,
      submittedAt: item.submittedAt,
      hours,
      slaHours,
      unassigned: false,
    });
  }

  for (const item of pendingUnassigned) {
    const hours = hoursSince(item.submittedAt, now);
    // No group means no course promise to look up either, so the school's own is the only
    // scale there is — and where the school promised nothing, waiting alone makes the row.
    const slaHours = sla.schoolHours;
    if (slaHours !== null && !isOverdue(hours, slaHours)) continue;

    rows.push({
      id: item.attemptId,
      studentId: item.userId,
      studentName: null,
      exerciseTitle: null,
      groupId: null,
      groupName: null,
      teacherName: null,
      submittedAt: item.submittedAt,
      hours,
      slaHours,
      unassigned: true,
    });
  }

  const oldest = rows.sort((a, b) => b.hours - a.hours).slice(0, STUCK_LIMIT);

  const people = await fetchProfileSummaries(oldest.map((row) => row.studentId));
  for (const row of oldest) {
    row.studentName = people[row.studentId]?.displayName ?? null;
  }

  return oldest;
}

async function fetchSchoolQueue(schoolId: string, groupIds: string[]): Promise<EngineQueueItem[]> {
  try {
    const queue = await serverFetch<{ groups: { items: EngineQueueItem[] }[] }>({
      service: 'exercises',
      path: '/internal/attempts/review/queue',
      method: 'POST',
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      // Grouped by exercise and sorted by the oldest submission, as the queue always is,
      // so the first page is where the late work is.
      body: { schoolId, groupIds, groupBy: 'exercise', limit: STUCK_SCAN },
    });
    return queue.groups.flatMap((group) => group.items);
  } catch {
    return [];
  }
}
