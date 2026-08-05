import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type {
  StartAttemptRequest,
  StartAttemptResponse,
} from '@/features/student/exercises/types/attempts';

/**
 * Start (or resume) an attempt at an exercise.
 *
 * The first route in this client that talks to the exercise engine. It exists because
 * `word_bank_gap_fill` cannot be graded in the browser: its answers are the words
 * missing from the sentences, so the only copy of them is on the server.
 *
 * A 409 is not an error to the caller — the engine reports the attempt already running,
 * and resuming it is the correct behaviour when a learner comes back to a page.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { language, mode } = body as StartAttemptRequest;
  if (typeof language !== 'string' || language.trim() === '') {
    return NextResponse.json({ error: '"language" is required' }, { status: 400 });
  }

  try {
    const data = await serverFetch<StartAttemptResponse>({
      service: 'exercises',
      path: `/exercises/${id}/attempts`,
      method: 'POST',
      body: { language, ...(mode === undefined ? {} : { mode }) },
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (e.code === 'not_found') {
        return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });
      }
      if (e.code === 'conflict') {
        // The engine puts the running attempt's id in the message. Passed through
        // as-is so the caller can resume rather than being told to try again.
        return NextResponse.json({ error: e.message }, { status: 409 });
      }
    }
    return NextResponse.json({ error: 'Failed to start attempt' }, { status: 502 });
  }
}
