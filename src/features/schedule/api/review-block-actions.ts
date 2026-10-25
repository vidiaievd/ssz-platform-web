'use server';

import type {
  MutationResult,
  NewReviewBlockInput,
  ReviewBlockChanges,
} from '@/lib/scheduling/provider';

/**
 * A refusal the screen can put in the teacher's words: the service's sentence for the
 * log, and its code (`TARGET_NOT_REVIEWER`, `ENDS_BEFORE_START`…) for the translation.
 */
export type ReviewBlockResult = { ok: true } | { ok: false; error: string; code: string | null };

function shape(result: MutationResult<unknown>): ReviewBlockResult {
  if (result.ok) return { ok: true };
  const code = (result.details as { code?: unknown } | undefined)?.code;
  return { ok: false, error: result.error, code: typeof code === 'string' ? code : null };
}

// Nothing to revalidate: the week is read per request and the dialogs refresh the route.

/** Hold the signed-in teacher's own time for marking in this workspace (plan 81). */
export async function createMyReviewBlock(
  workspaceId: string,
  input: NewReviewBlockInput,
): Promise<ReviewBlockResult> {
  const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
  return shape(await getSchedulingProvider().createReviewBlock(workspaceId, 'me', input));
}

/**
 * Hold a teacher's time for marking on the school's behalf (plan 81, step 7). scheduling
 * decides who may: an owner, an administrator, a manager or a scheduler of the school, and
 * only for somebody who marks work there.
 */
export async function createTeacherReviewBlock(
  schoolId: string,
  teacherId: string,
  input: NewReviewBlockInput,
): Promise<ReviewBlockResult> {
  const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
  return shape(await getSchedulingProvider().createReviewBlock(schoolId, teacherId, input));
}

export async function updateReviewBlock(
  blockId: string,
  changes: ReviewBlockChanges,
): Promise<ReviewBlockResult> {
  const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
  return shape(await getSchedulingProvider().patchReviewBlock(blockId, changes));
}

export async function deleteReviewBlock(blockId: string): Promise<ReviewBlockResult> {
  const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
  return shape(await getSchedulingProvider().deleteReviewBlock(blockId));
}

export async function skipReviewBlockDay(
  blockId: string,
  date: string,
): Promise<ReviewBlockResult> {
  const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
  return shape(await getSchedulingProvider().skipReviewBlockDay(blockId, date));
}
