import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import type {
  DisputeAiReviewRequest,
  DisputeAiReviewResponse,
} from '@/features/student/ai-review/types';

import { refusal } from '../refusal';

const MAX_REASON = 1000;

/**
 * "This review is wrong" — the learner's one say on a model's review (plan 79, step 2.3b).
 *
 * Once per review, and the engine keeps it so: a second press answers with the time of the
 * first and counts nothing. The verdict does not change; the platform hears that the model
 * got this one wrong. The reason is optional and travels as typed, trimmed, or not at all —
 * an empty box is no reason rather than an empty one.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> },
) {
  const { id, attemptId } = await params;

  let body: DisputeAiReviewRequest;
  try {
    body = ((await request.json()) ?? {}) as DisputeAiReviewRequest;
  } catch {
    body = {};
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length > MAX_REASON) {
    return NextResponse.json({ error: 'Reason is too long' }, { status: 400 });
  }

  try {
    const data = await serverFetch<DisputeAiReviewResponse>({
      service: 'exercises',
      path: `/exercises/${id}/attempts/${attemptId}/ai-review/dispute`,
      method: 'POST',
      body: reason === '' ? {} : { reason },
    });
    return NextResponse.json({ disputedAt: data.disputedAt } satisfies DisputeAiReviewResponse);
  } catch (e) {
    return refusal(e, 'Could not send the dispute');
  }
}
