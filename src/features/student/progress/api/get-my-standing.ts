import 'server-only';

import { z } from 'zod';

import type { StudentPosition } from '@/features/analytics/types';
import { serverFetch } from '@/lib/api/server-fetcher';
import { env } from '@/lib/env';

const PositionContext = z.object({
  schoolId: z.string().nullable(),
  groupId: z.string().nullable(),
  groupName: z.string().nullable(),
  showGroupPositionToStudents: z.boolean(),
});

/**
 * What the learner is allowed to be told about where they stand — and nothing else.
 *
 * `band` is the whole of it. The endpoint underneath answers with a percentile, a group
 * median and a count of classmates below them, because their teacher's screen needs all
 * three; the learner is shown none of it (§3.6). The numbers are dropped **here, on the
 * server**, so that no rank reaches the browser at all — a client that receives a
 * percentile and declines to render it has still handed it over.
 */
export interface MyStanding {
  band: 'below' | 'middle' | 'above';
  groupName: string | null;
}

/**
 * Where this learner stands in their group, if their school shows it at all.
 *
 * `null` covers every silence, and they are deliberately one silence to the caller: no
 * group, a school that turned the sentence off, a group where nobody has been measured,
 * or an upstream that could not answer. None of them is a position, and a screen that
 * distinguished them would be explaining the platform's plumbing to a student.
 */
export async function getMyStanding(userId: string): Promise<MyStanding | null> {
  if (!env.ORGANIZATION_SERVICE_INTERNAL_URL || !env.INTERNAL_SERVICE_TOKEN) return null;

  let context: z.infer<typeof PositionContext>;
  try {
    const raw = await serverFetch({
      service: 'organization',
      path: `/internal/students/${userId}/position-context`,
      directBaseUrl: env.ORGANIZATION_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN },
      anonymous: true,
    });
    const parsed = PositionContext.safeParse(raw);
    if (!parsed.success) return null;
    context = parsed.data;
  } catch {
    return null;
  }

  if (context.groupId === null || !context.showGroupPositionToStudents) return null;

  try {
    // As the learner themselves: analytics lets somebody read their own numbers, and
    // asking with the internal token would be a wider permission than this screen needs.
    const position = await serverFetch<StudentPosition | null>({
      service: 'analytics',
      path: `/analytics/students/${userId}/position`,
      query: { groupId: context.groupId },
    });

    // An empty body is how "there is no scale in this group" arrives, and it reaches here
    // as `undefined` rather than `null` (the trap phase 9 hit).
    if (!position) return null;

    return { band: position.band, groupName: context.groupName };
  } catch {
    return null;
  }
}
