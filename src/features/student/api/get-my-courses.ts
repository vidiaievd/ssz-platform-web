import 'server-only';

import { z } from 'zod';

import type { Container } from '@/features/content/types';
import { serverFetch } from '@/lib/api/server-fetcher';
import type { StudentCourse, StudentSchool } from '../types/learning';
import { getStudentSchools } from './get-student-schools';

/**
 * learning-service progress rows. These describe *how far* the student got,
 * never *what they have access to* — a course is missing here until the first
 * attempt is recorded, which is exactly why it cannot drive the course list.
 */
const RawProgressItem = z.object({
  containerId: z.string(),
  completedItems: z.number().int().min(0).default(0),
  totalItems: z.number().int().min(0).default(0),
  progressPercent: z.number().min(0).max(100).default(0),
  lastAccessedAt: z.string().optional(),
  nextItemId: z.string().optional(),
  nextItemTitle: z.string().optional(),
});

const RawEnrollment = z.object({
  containerId: z.string().optional(),
  /** Present when a school granted the enrollment rather than the student self-enrolling. */
  schoolId: z.string().nullish(),
  status: z.string(),
});

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

const RawGroupMembership = z.object({
  groupId: z.string(),
  groupName: z.string(),
  status: z.string(),
});

const RawGroup = z.object({
  courseId: z.string().nullish(),
  materials: z.array(z.object({ courseId: z.string() })).optional(),
});

/**
 * Every container the student reaches through a school group, with its school
 * context. This walks *all* of the student's active groups rather than reusing
 * `StudentSchool`, which models one group per school — a student in two groups
 * of the same school would otherwise lose one group's courses.
 */
async function schoolCourses(
  schools: StudentSchool[],
  myUserId: string,
): Promise<Map<string, StudentCourse['school']>> {
  const byContainer = new Map<string, StudentCourse['school']>();

  const perSchool = await Promise.all(
    schools.map(async (school) => {
      const raw = await safe(
        () =>
          serverFetch({
            service: 'organization',
            path: `/schools/${school.schoolId}/students/${myUserId}/memberships`,
          }),
        null,
      );
      const groups = (z.array(RawGroupMembership).safeParse(raw).data ?? []).filter(
        (g) => g.status === 'active',
      );

      return Promise.all(
        groups.map(async (group) => {
          const rawGroup = await safe(
            () =>
              serverFetch({
                service: 'organization',
                path: `/schools/${school.schoolId}/groups/${group.groupId}`,
              }),
            null,
          );
          const parsed = RawGroup.safeParse(rawGroup).data;
          const courseIds = [
            ...(parsed?.courseId ? [parsed.courseId] : []),
            ...(parsed?.materials ?? []).map((m) => m.courseId),
          ];
          return { school, group, courseIds };
        }),
      );
    }),
  );

  for (const { school, group, courseIds } of perSchool.flat()) {
    for (const courseId of courseIds) {
      // First group wins: a course shared by two groups still needs one label.
      if (byContainer.has(courseId)) continue;
      byContainer.set(courseId, {
        id: school.schoolId,
        slug: school.schoolSlug,
        name: school.schoolName,
        groupId: group.groupId,
        groupName: group.groupName,
      });
    }
  }

  return byContainer;
}

async function fetchContainers(ids: string[]): Promise<Map<string, Container>> {
  const entries = await Promise.all(
    ids.map(async (id) => {
      const container = await safe(
        () => serverFetch<Container>({ service: 'content', path: `/containers/${id}` }),
        null,
      );
      return [id, container] as const;
    }),
  );
  return new Map(
    entries.filter((e): e is [string, Container] => e[1] !== null),
  );
}

/**
 * Every course the student can open, from all three access routes, with
 * progress laid over the top. A student enrolled yesterday who has not opened
 * anything still gets their full list back — at 0%.
 */
export async function getMyCourses(
  myUserId: string,
  /** Pass an already-fetched list to avoid re-running the school aggregate. */
  prefetchedSchools?: StudentSchool[],
): Promise<StudentCourse[]> {
  const [schools, rawProgress, rawEnrollments] = await Promise.all([
    prefetchedSchools
      ? Promise.resolve(prefetchedSchools)
      : safe(() => getStudentSchools(myUserId), [] as StudentSchool[]),
    safe(() => serverFetch({ service: 'progress', path: '/progress' }), null),
    safe(() => serverFetch({ service: 'enrollment', path: '/enrollments' }), null),
  ]);

  const progressByContainer = new Map(
    (z.array(RawProgressItem).safeParse(rawProgress).data ?? []).map((p) => [p.containerId, p]),
  );

  const fromSchools = await schoolCourses(schools, myUserId);

  const enrolled = (z.array(RawEnrollment).safeParse(rawEnrollments).data ?? []).filter(
    (e) => e.status.toUpperCase() === 'ACTIVE' && e.containerId,
  );

  // A school-granted enrollment names its school even when org-service has no
  // group material for it — that's still a school course, not self-study.
  const schoolById = new Map(schools.map((s) => [s.schoolId, s]));
  for (const e of enrolled) {
    if (!e.schoolId || fromSchools.has(e.containerId!)) continue;
    const school = schoolById.get(e.schoolId);
    if (!school) continue;
    fromSchools.set(e.containerId!, {
      id: school.schoolId,
      slug: school.schoolSlug,
      name: school.schoolName,
      groupId: school.groupId ?? '',
      groupName: school.groupName ?? '',
    });
  }

  // Union of all three routes. A container reachable through a school keeps the
  // school label even when the student also enrolled in it themselves.
  const containerIds = [
    ...new Set([
      ...fromSchools.keys(),
      ...enrolled.map((e) => e.containerId!),
      ...progressByContainer.keys(),
    ]),
  ];
  if (!containerIds.length) return [];

  const containers = await fetchContainers(containerIds);

  return containerIds.flatMap((id) => {
    const container = containers.get(id);
    // A container we cannot describe is one we cannot render or link to.
    if (!container) return [];

    const school = fromSchools.get(id) ?? null;
    const progress = progressByContainer.get(id);

    // A course reached only through self-enrollment or progress, with no
    // school attached, is 'free' when the container itself is publicly free
    // — otherwise it's an ordinary self-study (paid/subscription) course.
    const source = school
      ? ('school' as const)
      : container.accessTier === 'public_free'
        ? ('free' as const)
        : ('self' as const);

    return [
      {
        containerId: id,
        title: container.title,
        targetLanguage: container.targetLanguage,
        level: container.difficultyLevel ?? null,
        source,
        school,
        started: progress !== undefined,
        progressPercent: progress?.progressPercent ?? 0,
        completedItems: progress?.completedItems ?? 0,
        totalItems: progress?.totalItems ?? container.lessonCount ?? 0,
        lastAccessedAt: progress?.lastAccessedAt ?? null,
        nextItemId: progress?.nextItemId ?? null,
        nextItemTitle: progress?.nextItemTitle ?? null,
      },
    ];
  });
}
