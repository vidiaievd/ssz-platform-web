import 'server-only';

import { cache } from 'react';
import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMySchools } from '@/features/school/api/get-my-schools';
import type { SchoolRole } from '@/features/school/types';
import { env } from '@/lib/env';

/** What one teacher may be shown: their groups in this school, and the courses behind them. */
export interface ReviewScope {
  schoolId: string;
  teacherId: string;
  /**
   * The caller's standing in this school. Administrators hold no queue of their own but
   * see everything in it (`DATA_MODEL.md` §3), so one submission's authorisation turns on
   * this where the queue's turns on group assignments.
   */
  role: SchoolRole | null;
  /** The groups this teacher is active on right now. Empty is a real, valid answer. */
  groupIds: string[];
  /** The courses those groups run. Not an authorisation — see `queueScopeFor`. */
  containerIds: string[];
}

/**
 * Resolve the caller's review scope in one school, or the response to send instead.
 *
 * Two questions, deliberately kept apart. *Are you in this school at all* is answered from
 * the caller's own membership list, and a no is a 403 — the review screens are staff
 * surfaces and a stranger asking about a school's queue gets nothing. *What may you see*
 * is then organization-service's answer, because `reviewers(sub)` (`DATA_MODEL.md` §3) is
 * a rule about group assignments and their date windows, and writing it a second time here
 * would mean two rules to keep in step.
 *
 * An empty scope is not a refusal. A teacher between assignments, or one who has been
 * added to a school but not yet to a group, is a perfectly ordinary person with an empty
 * inbox; answering 403 would tell them their account is broken.
 */
export async function resolveReviewScope(
  schoolSlugOrId: string,
): Promise<ReviewScope | NextResponse> {
  const user = await getCurrentUser();
  if (!user?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const schools = await getMySchools();
  const school = schools.find((s) => s.slug === schoolSlugOrId || s.id === schoolSlugOrId);
  // Not a member, or no such school — the same answer either way, so that probing the
  // route cannot be used to discover which schools exist.
  if (!school) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const scope = await reviewScopeAt(school.id, user.userId, new Date().toISOString());

    return {
      schoolId: school.id,
      teacherId: user.userId,
      role: school.myRole ?? null,
      groupIds: scope.groupIds,
      containerIds: scope.containerIds,
    };
  } catch {
    return NextResponse.json({ error: 'Failed to read the review scope' }, { status: 502 });
  }
}

/**
 * `reviewers(sub)` from the other side: which groups this teacher held at a given moment.
 *
 * A moment, not "now", because that is what the rule says — a reviewer is a teacher of the
 * learner's group *as of the submission* (`DATA_MODEL.md` §3). A substitution that ran for
 * a fortnight in June still owns what was handed in during it, and a teacher who joined
 * the group yesterday does not.
 *
 * Cached on the instant it is asked about, so a route that checks the same window twice —
 * once to read, once to write — pays for one round trip.
 */
export const reviewScopeAt = cache(async function (
  schoolId: string,
  teacherId: string,
  /** ISO-8601. A string rather than a `Date` so two asks about the same instant share
   *  the request cache — `cache()` keys on argument identity, and every `new Date()` is
   *  a fresh object. */
  at: string,
): Promise<{ groupIds: string[]; containerIds: string[] }> {
  const scope = await serverFetch<{ groupIds?: string[]; containerIds?: string[] }>({
    service: 'organization',
    path: '/internal/review/scope',
    directBaseUrl: env.ORGANIZATION_SERVICE_INTERNAL_URL,
    headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
    anonymous: true,
    query: { schoolId, teacherId, at },
  });

  return { groupIds: scope.groupIds ?? [], containerIds: scope.containerIds ?? [] };
});

/**
 * The scope as exercise-engine takes it, narrowed by the screen's filters.
 *
 * Only `groupIds` carries the authorisation, never `containerIds`. What makes someone a
 * reviewer is being a teacher of the learner's *group* — a course is material, and the
 * same course may be run by groups this teacher has nothing to do with. The engine ANDs
 * the two lists, so sending the scope's courses as well would additionally drop any
 * submission a learner of their own group made on a course their group does not run.
 *
 * A course filter then lands in `containerIds` and narrows correctly, because it is
 * intersected with groups the caller was already entitled to.
 *
 * `null` means the filters have selected something outside the scope — a group the caller
 * does not teach, say, from a link someone shared. That is an empty queue, not a refusal:
 * the caller is being told there is nothing there, which is true.
 */
export function queueScopeFor(
  scope: ReviewScope,
  filters: { group?: string | null; course?: string | null; type?: string | null },
): {
  schoolId: string;
  groupIds: string[];
  containerIds?: string[];
  templateCodes?: string[];
} | null {
  if (scope.groupIds.length === 0) return null;

  const groupIds = filters.group
    ? scope.groupIds.filter((id) => id === filters.group)
    : scope.groupIds;
  if (groupIds.length === 0) return null;

  return {
    schoolId: scope.schoolId,
    groupIds,
    ...(filters.course ? { containerIds: [filters.course] } : {}),
    ...(filters.type ? { templateCodes: [filters.type] } : {}),
  };
}

/**
 * Group names for the rows and the filter, keyed by id.
 *
 * Cached per request: the queue and its filter list ask the same question, and a name is
 * not worth a second round trip. A failure costs the names and not the screen — a queue
 * row reads perfectly well without its group beside it.
 */
export const fetchGroupNames = cache(async function (
  schoolId: string,
): Promise<Record<string, string>> {
  try {
    const groups = await serverFetch<{ id: string; name: string }[]>({
      service: 'organization',
      path: `/schools/${schoolId}/groups`,
    });
    return Object.fromEntries(groups.map((group) => [group.id, group.name]));
  } catch {
    return {};
  }
});

/** One option in the queue's filter row: something that actually has a queue behind it. */
export interface ReviewFacet {
  id: string;
  name: string;
}

/**
 * What the filter dropdowns may offer.
 *
 * Built from the teacher's *scope*, never from the page on screen. Deriving the options
 * from the rows would make the filters eat themselves: pick one course, and the only
 * option left would be that course, with no way back to the others except the browser's
 * back button.
 *
 * Course titles cost one read each. A teacher holds a handful of courses, the reads are
 * request-cached, and a title that cannot be fetched drops the course from the list rather
 * than offering an unlabelled one.
 */
export async function fetchQueueFacets(
  scope: ReviewScope,
): Promise<{ groups: ReviewFacet[]; courses: ReviewFacet[] }> {
  const [names, courses] = await Promise.all([
    fetchGroupNames(scope.schoolId),
    Promise.all(scope.containerIds.map(fetchCourseTitle)),
  ]);

  return {
    groups: scope.groupIds
      .map((id) => ({ id, name: names[id] ?? '' }))
      .filter((facet) => facet.name !== '')
      .sort((a, b) => a.name.localeCompare(b.name)),
    courses: courses
      .filter((facet): facet is ReviewFacet => facet !== null)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

const fetchCourseTitle = cache(async function (id: string): Promise<ReviewFacet | null> {
  try {
    const container = await serverFetch<{ title: string }>({
      service: 'content',
      path: `/containers/${id}`,
    });
    return container.title ? { id, name: container.title } : null;
  } catch {
    return null;
  }
});
