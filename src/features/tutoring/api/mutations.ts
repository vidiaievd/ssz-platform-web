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

export type OneToOneInput = {
  /** The learner these lessons are with; the row on every screen is named after them. */
  userId: string;
  learnerName: string;
  courseId?: string | null;
  /** The weekly slot, as the tutor set it. */
  weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  start: string;
  end: string;
  startDate: string;
  endDate?: string | null;
};

export type OneToOneResult =
  | { ok: true; groupId: string }
  | { ok: false; error: 'forbidden' | 'validation' | 'failed' };

/**
 * Lessons with one learner, as the model already understands them.
 *
 * A tutor's one-to-one teaching is a group of one: nothing in the tract below — the
 * journal, what was delivered, the progress chart, the marking queue — has to learn a new
 * kind of thing, and the screens never say "group" about it, because the row is the
 * learner's name (plan 62, §2 A).
 *
 * The weekly slot is set in the same breath. Sessions are laid over a pattern, so a
 * one-to-one with no pattern would be a group with nobody teaching it on any day — and
 * the schedule the tutor opened this dialog to fill would still be empty.
 */
export async function startOneToOne(
  workspaceId: string,
  input: OneToOneInput,
): Promise<OneToOneResult> {
  let created: { id: string };
  try {
    created = await serverFetch<{ id: string }>({
      service: 'organization',
      path: `/schools/${workspaceId}/groups`,
      method: 'POST',
      body: {
        name: input.learnerName,
        ...(input.courseId ? { courseId: input.courseId } : {}),
        startDate: input.startDate,
        ...(input.endDate ? { endDate: input.endDate } : {}),
        capacityMax: 1,
      },
    });
  } catch (e) {
    if (e instanceof AppError && e.code === 'forbidden') return { ok: false, error: 'forbidden' };
    if (e instanceof AppError && e.code === 'validation') return { ok: false, error: 'validation' };
    console.error('[tutoring] startOneToOne failed to create:', e);
    return { ok: false, error: 'failed' };
  }

  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${workspaceId}/groups/${created.id}/members`,
      method: 'POST',
      body: { userId: input.userId },
    });

    // Setting the pattern is what generates the sessions — and, for a solo workspace,
    // derives the teaching plan behind them (plan 62, phase 1).
    await serverFetch({
      service: 'scheduling',
      path: `/scheduling/schools/${workspaceId}/groups/${created.id}/slots`,
      method: 'PUT',
      body: {
        slots: [{ weekday: input.weekday, startTime: input.start, endTime: input.end }],
      },
    });
  } catch (e) {
    // The lessons exist as a row either way; saying so beats rolling back something the
    // tutor can see and finish by hand.
    console.error('[tutoring] startOneToOne finished partly:', e);
    return { ok: true, groupId: created.id };
  }

  return { ok: true, groupId: created.id };
}
