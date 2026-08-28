import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type {
  AnswerOptionRequest,
  AnswerQuestionResponse,
  AnswerTextRequest,
} from '@/features/student/exercises/types/attempts';

/**
 * Hand in one question of a set — two templates are answered a question at a time.
 *
 * `short_answer` sends what the student wrote; `multiple_choice` sends the option they
 * picked, or `reveal` for «Vis svaret». In both the payload goes up rather than the
 * verdict coming down, and for the same reason: the key is the exercise. For
 * `short_answer` it is a set of anchor phrases — the answer in the words the student is
 * asked to find. For `multiple_choice` it is which option is right, and the whole
 * mechanic of a second try and a 50/50 rests on the browser not knowing it (plan 53 §3.2).
 *
 * The two are told apart by the payload, and the attempt's own template decides upstream
 * which one it will read. Neither is graded here.
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

  const raw = body as Partial<AnswerTextRequest & AnswerOptionRequest>;
  const { questionId } = raw;
  if (typeof questionId !== 'string' || questionId.trim() === '') {
    return NextResponse.json({ error: '"questionId" is required' }, { status: 400 });
  }

  // Which shape this is, decided by the payload rather than by a mode flag — the same
  // test the engine's handler makes. `optionId` present at all, even as null, means a
  // pick; `reveal` alone is «Vis svaret», which is a pick of nothing.
  const picking = 'optionId' in raw || raw.reveal === true;

  let forwarded: Record<string, unknown>;
  if (picking) {
    const { optionId, reveal } = raw;
    if (optionId !== null && typeof optionId !== 'string') {
      return NextResponse.json({ error: '"optionId" must be a string or null' }, { status: 400 });
    }
    // A pick of nothing is only meaningful as «Vis svaret», which says so. Without it
    // the engine would have to guess whether the learner meant to close the question.
    if (reveal !== true && (optionId === null || optionId === '')) {
      return NextResponse.json({ error: '"optionId" is required' }, { status: 400 });
    }
    forwarded = {
      questionId,
      ...(typeof optionId === 'string' && optionId !== '' ? { optionId } : {}),
      ...(reveal === true ? { reveal: true } : {}),
    };
  } else {
    // Refused here as well as upstream: an empty answer handed in is a `fail` the learner
    // can never revisit, and the cheapest place to stop it is before it is written down.
    const { text } = raw;
    if (typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json({ error: '"text" is required' }, { status: 400 });
    }
    forwarded = { questionId, text };
  }

  try {
    const data = await serverFetch<AnswerQuestionResponse>({
      service: 'exercises',
      path: `/exercises/${id}/attempts/${attemptId}/answers`,
      method: 'POST',
      body: forwarded,
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
