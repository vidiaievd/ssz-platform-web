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
    }
    return NextResponse.json({ error: 'Failed to check the answer' }, { status: 502 });
  }
}
