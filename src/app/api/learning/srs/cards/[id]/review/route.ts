import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import { REVIEW_RATINGS, type ReviewRequest, type ReviewResponse } from '@/features/learning/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { rating, reviewedAt, idempotencyKey } = body as ReviewRequest;

  // The server takes the FSRS grade as a string enum and rejects anything else
  // (including the numeric 1..4 this route used to forward, and the `latencyMs`
  // it used to require — learning-service validates with forbidNonWhitelisted).
  if (!rating || !REVIEW_RATINGS.includes(rating)) {
    return NextResponse.json(
      { error: `"rating" must be one of ${REVIEW_RATINGS.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const data = await serverFetch<ReviewResponse>({
      service: 'progress',
      path: `/srs/cards/${id}/review`,
      method: 'POST',
      // idempotencyKey is optional upstream, but always sent from here so a
      // retried submission cannot reschedule the same card twice.
      body: { rating, reviewedAt, idempotencyKey },
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'rate_limited') return NextResponse.json({ error: 'Daily limit reached' }, { status: 429 });
      if (e.code === 'not_found') return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 502 });
  }
}
