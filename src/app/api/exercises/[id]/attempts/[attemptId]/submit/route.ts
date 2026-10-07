import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type {
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from '@/features/student/exercises/types/attempts';

/**
 * Check an answer. The verdict and the explanations come back; the answers do not —
 * being wrong is not a way to be handed the word. That is what the reveal route is for,
 * and it is a separate action on purpose.
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

  const { submittedAnswer, timeSpentSeconds, locale } = body as SubmitAnswerRequest;
  if (submittedAnswer === undefined || typeof timeSpentSeconds !== 'number') {
    return NextResponse.json(
      { error: '"submittedAnswer" and "timeSpentSeconds" are required' },
      { status: 400 },
    );
  }

  try {
    const data = await serverFetch<SubmitAnswerResponse>({
      service: 'exercises',
      path: `/exercises/${id}/attempts/${attemptId}/submit`,
      method: 'POST',
      body: { submittedAnswer, timeSpentSeconds, ...(locale === undefined ? {} : { locale }) },
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
      // `read_aloud` recordings that do not stand up (plan 70 §3.5): the code and the prompts
      // it names, so the runner can point at the take to record again. Nothing was written.
      const refusal = recordingRefusal(e.details);
      if (e.code === 'validation' && refusal !== null) {
        return NextResponse.json({ error: 'Recordings refused', ...refusal }, { status: 422 });
      }
      // The engine could not ask media-service about the recordings. Nothing was written and
      // the draft is intact — a try again later, not a failure to resolve.
      if (e.code === 'upstream_unavailable' && codeOf(e.details) === 'MEDIA_UNAVAILABLE') {
        return NextResponse.json(
          { error: 'Recordings could not be checked', code: 'MEDIA_UNAVAILABLE' },
          { status: 503 },
        );
      }
    }
    return NextResponse.json({ error: 'Failed to check the answer' }, { status: 502 });
  }
}

function codeOf(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const { code } = details as { code?: unknown };
  return typeof code === 'string' ? code : null;
}

function recordingRefusal(details: unknown): { code: string; itemIds: string[] } | null {
  const code = codeOf(details);
  if (code === null || !code.startsWith('RA_RECORDING_')) return null;
  const { itemIds } = details as { itemIds?: unknown };
  return {
    code,
    itemIds: Array.isArray(itemIds)
      ? itemIds.filter((x): x is string => typeof x === 'string')
      : [],
  };
}
