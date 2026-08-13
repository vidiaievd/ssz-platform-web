import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type {
  SelfCheckRequest,
  SelfCheckResponse,
} from '@/features/student/exercises/types/attempts';

/**
 * Ask how the work is going without handing it in — `error_correction` only.
 *
 * The draft goes up rather than the count coming down, because counting corrected
 * mistakes needs the answer key, and the key stays on the server. Nothing is submitted:
 * the attempt stays in progress, one self-check poorer.
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

  const { draftAnswer } = body as SelfCheckRequest;
  if (draftAnswer === undefined) {
    return NextResponse.json({ error: '"draftAnswer" is required' }, { status: 400 });
  }

  try {
    const data = await serverFetch<SelfCheckResponse>({
      service: 'exercises',
      path: `/exercises/${id}/attempts/${attemptId}/self-check`,
      method: 'POST',
      body: { draftAnswer },
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (e.code === 'forbidden') {
        return NextResponse.json({ error: 'Not your attempt' }, { status: 403 });
      }
      if (e.code === 'not_found') {
        return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
      }
      // The engine's 422: the budget is spent, the answer is already in, or this
      // template has no self-check. Kept apart from a genuine failure so the runner
      // can put the button away instead of offering a retry that cannot work.
      if (e.code === 'validation') {
        return NextResponse.json({ error: 'No self-check available' }, { status: 422 });
      }
    }
    return NextResponse.json({ error: 'Could not check the work' }, { status: 502 });
  }
}
