import 'server-only';

import type { StudentGrid, StudentPosition, StudentWorkContext } from '@/features/analytics/types';
import { getMasteryProfile } from '@/features/mastery/api/get-mastery-profile';
import type { MasteryProfile } from '@/features/mastery/types';
import { serverFetch } from '@/lib/api/server-fetcher';

export interface StudentMastery {
  /** The group the numbers are read against — the learner's first active one. */
  groupId: string | null;
  courseId: string | null;
  /** `null` means analytics could not be asked — never "this learner has nothing". */
  grid: StudentGrid | null;
  /** `null` is a real answer: a group where nobody was measured has no scale. */
  position: StudentPosition | null;
  workContext: StudentWorkContext | null;
  /** The weakest cells with their reason — the profile, not the grid. */
  profile: MasteryProfile | null;
}

/**
 * An upstream that cannot answer degrades to `null`; it must not empty the page.
 *
 * `?? null` is not tidying: the position endpoint answers "there is no scale" with an
 * empty body, which arrives as `undefined`, and a screen that only guards against `null`
 * then reads a field off nothing. Both silences become the same one here, once.
 */
async function ask<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return (await fn()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Everything screen C draws, in one place — plan 58, phase 9.
 *
 * Four upstream answers, each allowed to be missing on its own. They are genuinely
 * independent questions: what this learner is good at (analytics' grid), what to do about
 * it (the profile's `reason`), where the work happens, and where they stand. A group with
 * no course still has a grid; a group where nobody was measured still has a profile. The
 * screen says which of them is missing rather than folding them into one empty state.
 *
 * The course is resolved from the group rather than from the learner: the grid is scoped
 * to a course so that `noContent` can mean "this course teaches none of this", which is
 * the sentence that keeps an empty `listening` row from reading as a verdict on the
 * learner.
 */
export async function getStudentMastery({
  schoolId,
  studentId,
  groupIds,
}: {
  schoolId: string;
  studentId: string;
  /**
   * The learner's active groups, most relevant first — the caller's order is respected.
   *
   * A list rather than one id because a learner may sit in three groups and only one of
   * them teaches a course; reading their profile against a group with no course would
   * scope the grid to nothing and report "nobody has been measured" about a class that
   * has been measured all term.
   */
  groupIds: readonly string[];
}): Promise<StudentMastery> {
  const { groupId, courseId } = await pickGroup(schoolId, groupIds);

  const [grid, position, workContext, profile] = await Promise.all([
    ask(() =>
      serverFetch<StudentGrid>({
        service: 'analytics',
        path: `/analytics/students/${studentId}/grid`,
        query: { courseId: courseId ?? undefined },
      }),
    ),
    groupId === null
      ? Promise.resolve(null)
      : ask(() =>
          serverFetch<StudentPosition | null>({
            service: 'analytics',
            path: `/analytics/students/${studentId}/position`,
            query: { groupId },
          }),
        ),
    ask(() =>
      serverFetch<StudentWorkContext>({
        service: 'analytics',
        path: `/analytics/students/${studentId}/work-context`,
        query: { courseId: courseId ?? undefined },
      }),
    ),
    getMasteryProfile(studentId, courseId === null ? {} : { courseId }),
  ]);

  return { groupId, courseId, grid, position, workContext, profile };
}

/**
 * The group this learner's numbers are read against: the first of theirs that teaches a
 * course, or — if none does — the first of them, so that the position still has a roster
 * to compare against even when there is no course to compare on.
 */
async function pickGroup(
  schoolId: string,
  groupIds: readonly string[],
): Promise<{ groupId: string | null; courseId: string | null }> {
  for (const groupId of groupIds) {
    const group = await ask(() =>
      serverFetch<{ courseId?: string | null }>({
        service: 'organization',
        path: `/schools/${schoolId}/groups/${groupId}`,
      }),
    );
    if (group?.courseId) return { groupId, courseId: group.courseId };
  }

  return { groupId: groupIds[0] ?? null, courseId: null };
}
