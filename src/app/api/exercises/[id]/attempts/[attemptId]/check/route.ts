import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';

/** The engine waits on a model for up to 110 s; the gateway gives it 120 (plan 84, step 5). */
const CHECK_TIMEOUT_MS = 125_000;

/**
 * «Check» before hand-in — a rehearsal with a model (plan 84, step 8).
 *
 * The draft goes up, the reading comes down; the attempt stays in progress and nothing is
 * published, so nothing here moves progress or rates a card. The engine owns every decision —
 * the school's switch, the plan, the limits — and answers 200 for anything the model itself
 * can say (`ai.status`). This route only tells the refusals of the school or the plan apart
 * from a fault: 403 and 409 are final for this attempt (the button goes), 503 and 502 are
 * worth another try.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> },
) {
  const { id, attemptId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { draftAnswer } = (body ?? {}) as { draftAnswer?: unknown };
  if (draftAnswer === undefined) {
    return NextResponse.json({ error: '"draftAnswer" is required' }, { status: 400 });
  }

  try {
    const data = await serverFetch({
      service: 'exercises',
      path: `/exercises/${id}/attempts/${attemptId}/check`,
      method: 'POST',
      body: { draftAnswer },
      timeoutMs: CHECK_TIMEOUT_MS,
      expectedErrorStatuses: [400, 403, 409, 503],
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (e.code === 'forbidden') {
        return NextResponse.json({ error: 'Check not available' }, { status: 403 });
      }
      if (e.code === 'not_found') {
        return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
      }
      if (e.code === 'conflict') {
        return NextResponse.json({ error: 'Already handed in' }, { status: 409 });
      }
      if (e.code === 'validation') {
        return NextResponse.json({ error: 'The draft could not be read' }, { status: 400 });
      }
      if (e.code === 'upstream_unavailable') {
        return NextResponse.json({ error: 'Check unavailable' }, { status: 503 });
      }
    }
    return NextResponse.json({ error: 'Could not check the work' }, { status: 502 });
  }
}
