import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type {
  CheckRowRequest,
  CheckRowResponse,
} from '@/features/student/exercises/types/attempts';

/**
 * Check one sentence of a `sentence_schema` set, or ask to be shown it.
 *
 * The board goes up rather than the verdict coming down, for the reason this template was
 * rewritten: which field each piece belongs in is the answer key, and it never reaches
 * the browser. Nothing here could grade this, and nothing here is given the chance to.
 *
 * A sentence may be checked as often as the learner likes. It closes by being solved or
 * by `reveal`, and a closed one is refused upstream — the reveal in particular, because a
 * sentence that was shown scores nothing and a client must not be able to replay it as
 * one that was solved.
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

  const { rowId, placement, reveal } = body as CheckRowRequest;
  if (typeof rowId !== 'string' || rowId.trim() === '') {
    return NextResponse.json({ error: '"rowId" is required' }, { status: 400 });
  }
  if (typeof placement !== 'object' || placement === null || Array.isArray(placement)) {
    return NextResponse.json({ error: '"placement" must be a board' }, { status: 400 });
  }
  // Every field holds an ordered list of ids and nothing else. Checked here as well as
  // upstream because a malformed board is a client bug, and the cheapest place to catch
  // one is before it costs a round trip.
  for (const items of Object.values(placement)) {
    if (!Array.isArray(items) || items.some((item) => typeof item !== 'string')) {
      return NextResponse.json({ error: '"placement" must be a board' }, { status: 400 });
    }
  }

  try {
    const data = await serverFetch<CheckRowResponse>({
      service: 'exercises',
      path: `/exercises/${id}/attempts/${attemptId}/rows`,
      method: 'POST',
      body: { rowId, placement, reveal: reveal === true },
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
      // The engine's refusal, 400 and 422 alike: this sentence is already closed, the
      // attempt is no longer in progress, the set has no such sentence, or the board is
      // empty. One status because the runner does one thing with all of them — say so and
      // stop offering the button. Kept apart from a broken upstream, which is worth
      // another try.
      if (e.code === 'validation') {
        return NextResponse.json({ error: 'This sentence cannot be checked' }, { status: 422 });
      }
    }
    return NextResponse.json({ error: 'Could not check the sentence' }, { status: 502 });
  }
}
