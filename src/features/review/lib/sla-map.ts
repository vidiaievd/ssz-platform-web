import 'server-only';

import { cache } from 'react';

import { serverFetch } from '@/lib/api/server-fetcher';

/**
 * What a course promises a learner, and what the school promises behind it.
 *
 * `slaFor` is the only thing the screens need, but both numbers are carried because the
 * settings screens (plan 46) show the inherited value beside the override — a field that
 * says "inherited" and is blank is worse than one that says 48.
 */
export interface SlaMap {
  schoolHours: number | null;
  /** Only courses that override. Absence means "inherits", not "unknown". */
  byCourse: Record<string, number>;
  /** The promise a submission of this course is coloured against. */
  slaFor(containerId: string | null): number | null;
}

/**
 * The school's promise. One call, cached for the request.
 *
 * Null rather than a platform default when it cannot be read: a promise nobody made is not
 * a promise to hold anyone to, and colouring a queue against an invented 48 hours would
 * show a school lateness it never agreed to.
 */
const fetchSchoolHours = cache(async function (schoolId: string): Promise<number | null> {
  try {
    const settings = await serverFetch<{ respondWithinHours: number | null }>({
      service: 'organization',
      path: `/schools/${schoolId}/review-settings`,
    });
    return settings.respondWithinHours ?? null;
  } catch {
    return null;
  }
});

/**
 * A course's own promise, or null where it inherits.
 *
 * content-service already resolves inheritance and answers with both numbers, so the
 * override is the only part read here — mixing its resolved value into the map would hide
 * which courses actually set one, and plan 46 needs that distinction.
 */
const fetchCourseOverride = cache(async function (containerId: string): Promise<number | null> {
  try {
    const settings = await serverFetch<{
      respondWithinHours: number | null;
      overridden: boolean;
    }>({ service: 'content', path: `/containers/${containerId}/review-settings` });
    return settings.overridden ? (settings.respondWithinHours ?? null) : null;
  } catch {
    return null;
  }
});

/**
 * The promises in play for one page of a queue.
 *
 * The school is asked once; the courses are asked for in parallel and only for those
 * actually present in the answer, because a teacher's queue touches a handful of courses
 * and the school may hold hundreds. Both lookups are request-cached, so the queue route
 * and the count route beside it do not ask twice.
 *
 * A failure anywhere costs a promise, never the queue: a submission with no promise gets
 * no colour and no lateness, which is exactly what "nobody said when this would be
 * answered" should look like.
 */
export async function buildSlaMap(schoolId: string, containerIds: string[]): Promise<SlaMap> {
  const unique = [...new Set(containerIds.filter(Boolean))];

  const [schoolHours, overrides] = await Promise.all([
    fetchSchoolHours(schoolId),
    Promise.all(unique.map(async (id) => [id, await fetchCourseOverride(id)] as const)),
  ]);

  const byCourse: Record<string, number> = {};
  for (const [id, hours] of overrides) {
    if (hours !== null) byCourse[id] = hours;
  }

  return {
    schoolHours,
    byCourse,
    slaFor(containerId) {
      if (containerId !== null && containerId in byCourse) return byCourse[containerId] ?? null;
      return schoolHours;
    },
  };
}
