import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';

/** One sentence is one speech call and, with weak sounds, one explanation: seconds, not minutes. */
const SENTENCE_CHECK_TIMEOUT_MS = 60_000;

/**
 * One sentence of a reading, heard on its own (platform plan 86, step 6g).
 *
 * The engine owns every decision — the school's switch, the plan, the day's tries for the
 * sentence — and answers 200 for anything the model itself can say (`status`). This route only
 * tells the final refusals (403 the school switched checks off, 409 already handed in) apart
 * from a fault, and passes a 422 of the take or the sentence on with its code, so the drill can
 * ask for a new take. Nothing about the attempt moves.
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

  const { itemId, sentence, recordingAssetId, explanationLanguage } = (body ?? {}) as {
    itemId?: unknown;
    sentence?: unknown;
    recordingAssetId?: unknown;
    explanationLanguage?: unknown;
  };
  if (
    typeof itemId !== 'string' ||
    typeof sentence !== 'string' ||
    typeof recordingAssetId !== 'string'
  ) {
    return NextResponse.json(
      { error: '"itemId", "sentence" and "recordingAssetId" are required' },
      { status: 400 },
    );
  }

  try {
    const data = await serverFetch({
      service: 'exercises',
      path: `/exercises/${id}/attempts/${attemptId}/sentence-checks`,
      method: 'POST',
      body: {
        itemId,
        sentence,
        recordingAssetId,
        ...(typeof explanationLanguage === 'string' ? { explanationLanguage } : {}),
      },
      timeoutMs: SENTENCE_CHECK_TIMEOUT_MS,
      expectedErrorStatuses: [400, 403, 409, 422, 503],
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
        return NextResponse.json({ error: 'The sentence could not be heard' }, { status: 422 });
      }
      if (e.code === 'upstream_unavailable') {
        return NextResponse.json({ error: 'Check unavailable' }, { status: 503 });
      }
    }
    return NextResponse.json({ error: 'Could not check the sentence' }, { status: 502 });
  }
}
