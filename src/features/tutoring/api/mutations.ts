'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

export type CreateTutorGroupInput = {
  name: string;
  courseId?: string | null;
  /** Learners to put in it straight away — the roster is the only place to pick from. */
  userIds?: string[];
};

export type CreateTutorGroupResult =
  | { ok: true; id: string; notAdded: number }
  | { ok: false; error: 'forbidden' | 'validation' | 'failed' };

/**
 * A tutor's group, made in one step.
 *
 * The school flow is six screens because a school drafts a group in one office and
 * teaches it in another; a tutor is both, so the group opens on creation with them on
 * it (organization-service does that for a SOLO workspace) and the learners they ticked
 * are added right after. Adding a learner is a separate call per member on the server,
 * so a name that fails to join does not undo the group — it is reported instead.
 */
export async function createTutorGroup(
  workspaceId: string,
  input: CreateTutorGroupInput,
): Promise<CreateTutorGroupResult> {
  let created: { id: string };
  try {
    created = await serverFetch<{ id: string }>({
      service: 'organization',
      path: `/schools/${workspaceId}/groups`,
      method: 'POST',
      body: {
        name: input.name,
        ...(input.courseId ? { courseId: input.courseId } : {}),
      },
    });
  } catch (e) {
    if (e instanceof AppError && e.code === 'forbidden') return { ok: false, error: 'forbidden' };
    if (e instanceof AppError && e.code === 'validation') return { ok: false, error: 'validation' };
    console.error('[tutoring] createTutorGroup failed:', e);
    return { ok: false, error: 'failed' };
  }

  const userIds = input.userIds ?? [];
  const outcomes = await Promise.all(
    userIds.map((userId) =>
      serverFetch({
        service: 'organization',
        path: `/schools/${workspaceId}/groups/${created.id}/members`,
        method: 'POST',
        body: { userId },
      }).then(
        () => true,
        (e: unknown) => {
          console.error('[tutoring] add member to new group failed:', e);
          return false;
        },
      ),
    ),
  );

  return { ok: true, id: created.id, notAdded: outcomes.filter((added) => !added).length };
}
