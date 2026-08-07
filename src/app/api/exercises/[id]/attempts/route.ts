import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type {
  CheckMode,
  StartAttemptRequest,
  StartAttemptResponse,
} from '@/features/student/exercises/types/attempts';

/** The engine reports the running attempt's id in a field of the 409 body. */
function attemptIdOf(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const { attemptId } = details as { attemptId?: unknown };
  return typeof attemptId === 'string' && attemptId !== '' ? attemptId : null;
}

/**
 * Abandon the stale attempt and start again. Returns `null` if either step fails, so
 * the caller reports the conflict rather than a half-recovered state.
 */
async function restart(
  exerciseId: string,
  staleAttemptId: string,
  language: string,
  mode: CheckMode | undefined,
): Promise<StartAttemptResponse | null> {
  try {
    await serverFetch({
      service: 'exercises',
      path: `/exercises/${exerciseId}/attempts/${staleAttemptId}`,
      method: 'DELETE',
    });
    return await serverFetch<StartAttemptResponse>({
      service: 'exercises',
      path: `/exercises/${exerciseId}/attempts`,
      method: 'POST',
      body: { language, ...(mode === undefined ? {} : { mode }) },
    });
  } catch {
    return null;
  }
}

/**
 * Start an attempt at an exercise.
 *
 * The first route in this client that talks to the exercise engine. It exists because
 * `word_bank_gap_fill` cannot be graded in the browser: its answers are the words
 * missing from the sentences, so the only copy of them is on the server.
 *
 * **Re-opening is the common case, not an edge one.** The engine keeps an attempt
 * IN_PROGRESS until something is submitted, so a learner who leaves the page and comes
 * back conflicts with themselves every time. This route clears that: an attempt with
 * nothing submitted holds nothing worth keeping — the placements only ever lived in the
 * browser — so it is abandoned, which is the truth of what happened, and a fresh one is
 * started. Doing it here rather than in the client keeps a three-step recovery out of a
 * component's render path.
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
        const stale = attemptIdOf(e.details);
        if (stale !== null) {
          const restarted = await restart(id, stale, language, mode);
          if (restarted !== null) return NextResponse.json(restarted);
        }
        return NextResponse.json({ error: 'An attempt is already in progress' }, { status: 409 });
      }
    }
    return NextResponse.json({ error: 'Failed to start attempt' }, { status: 502 });
  }
}
