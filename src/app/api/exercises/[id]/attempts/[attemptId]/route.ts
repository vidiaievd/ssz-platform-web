import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { AttemptStatus, AttemptStatusResponse } from '@/features/student/exercises/types/attempts';

/**
 * The status of one attempt — nothing else about it. The runner calls this after a
 * `submit` request fails, to tell a lost request from a lost response (47.0.B): the
 * attempt is `IN_PROGRESS` either way the request never landed, and already
 * `ROUTED_FOR_REVIEW` / `SCORED` when it did and only the answer got back. Only the
 * status makes that distinction, so only the status is returned — the answer, the
 * validator's output, none of it is this check's business, and none of it should have
 * a reason to leave the engine over a question this narrow.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> },
) {
  const { id, attemptId } = await params;

  try {
    const data = await serverFetch<{ status: AttemptStatus }>({
      service: 'exercises',
      path: `/exercises/${id}/attempts/${attemptId}`,
      method: 'GET',
    });
    return NextResponse.json({ status: data.status } satisfies AttemptStatusResponse);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (e.code === 'not_found' || e.code === 'forbidden') {
        return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
      }
    }
    return NextResponse.json({ error: 'Failed to load attempt' }, { status: 502 });
  }
}
