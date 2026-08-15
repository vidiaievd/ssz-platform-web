import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { env } from '@/lib/env';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { mayEditExercise } from '@/features/content-authoring/lib/may-edit-exercise';
import type {
  ReviewAttemptRequest,
  ReviewAttemptResult,
} from '@/features/content-authoring/types/review';

/**
 * A teacher's verdict on one submission.
 *
 * Same gate as the queue it was opened from, checked again here rather than trusted from
 * there: a screen that was allowed to *read* the queue five minutes ago is not by itself
 * a right to write into it now.
 *
 * The reviewer's id is taken from the session, never from the request body. The internal
 * route accepts whatever id it is handed, so this is the place where "who marked it" is
 * decided — and a client that could choose it could sign another teacher's name.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> },
) {
  const { id, attemptId } = await params;

  const allowed = await mayEditExercise(id);
  if (allowed !== true) return allowed;

  const user = await getCurrentUser();
  if (user?.userId === undefined) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as ReviewAttemptRequest;
  if (body.outcome !== 'approved' && body.outcome !== 'returned') {
    return NextResponse.json({ error: 'outcome must be approved or returned' }, { status: 400 });
  }

  try {
    const data = await serverFetch<ReviewAttemptResult>({
      service: 'exercises',
      path: `/internal/attempts/${attemptId}/review`,
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      method: 'POST',
      body: {
        reviewerId: user.userId,
        outcome: body.outcome,
        decisions: body.decisions ?? [],
        comment: body.comment ?? undefined,
      },
    });
    return NextResponse.json(data);
  } catch {
    // The engine refuses anything that is no longer waiting — marked by a colleague a
    // minute ago, or never routed for review. Either way the queue is what is stale.
    return NextResponse.json({ error: 'Failed to review this submission' }, { status: 409 });
  }
}
