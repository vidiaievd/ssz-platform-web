import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { RevealAnswersResponse } from '@/features/student/exercises/types/attempts';

/**
 * Show the answers, because the learner asked.
 *
 * The only route in this client that returns answer text — for the two templates that
 * withhold it, `word_bank_gap_fill` and `match_pairs`. The payload is discriminated by
 * `templateCode` and passed through as it comes. It takes no body: there is nothing to
 * say beyond "show me", and the engine records that the asking happened.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> },
) {
  const { id, attemptId } = await params;

  try {
    const data = await serverFetch<RevealAnswersResponse>({
      service: 'exercises',
      path: `/exercises/${id}/attempts/${attemptId}/reveal`,
      method: 'POST',
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
    }
    // 422 from the engine lands here: nothing submitted yet, or a template that
    // never withheld its answers in the first place.
    return NextResponse.json({ error: 'Cannot show the answers yet' }, { status: 502 });
  }
}
