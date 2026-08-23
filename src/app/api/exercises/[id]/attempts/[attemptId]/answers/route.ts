import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type {
  AnswerQuestionRequest,
  AnswerQuestionResponse,
} from '@/features/student/exercises/types/attempts';

/**
 * Hand in one question of a `short_answer` set — the set is answered a question at a
 * time, and each answer is final.
 *
 * The text goes up rather than the verdict coming down, for the reason this template
 * exists: its key is a set of anchor phrases, which is the answer written in the words
 * the student is being asked to find. Nothing in the browser could grade this, and
 * nothing in the browser is given the chance to.
 *
 * The attempt stays in progress. It is closed by `POST /submit` with every answer in one
 * aggregate, which regrades all of them from scratch.
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

  const { questionId, text } = body as AnswerQuestionRequest;
  if (typeof questionId !== 'string' || questionId.trim() === '') {
    return NextResponse.json({ error: '"questionId" is required' }, { status: 400 });
  }
  // Refused here as well as upstream: an empty answer handed in is a `fail` the learner
  // can never revisit, and the cheapest place to stop it is before it is written down.
  if (typeof text !== 'string' || text.trim() === '') {
    return NextResponse.json({ error: '"text" is required' }, { status: 400 });
  }

  try {
    const data = await serverFetch<AnswerQuestionResponse>({
      service: 'exercises',
      path: `/exercises/${id}/attempts/${attemptId}/answers`,
      method: 'POST',
      body: { questionId, text },
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
      // The engine's refusal, 400 and 422 alike: this question is already answered, the
      // attempt is no longer in progress, the set has no such question, or it is not
      // answered a question at a time. One status because the runner does one thing with
      // all of them — say so and stop offering the button. Kept apart from a broken
      // upstream, which is worth another try.
      if (e.code === 'validation') {
        return NextResponse.json({ error: 'This answer cannot be handed in' }, { status: 422 });
      }
    }
    return NextResponse.json({ error: 'Could not hand in the answer' }, { status: 502 });
  }
}
