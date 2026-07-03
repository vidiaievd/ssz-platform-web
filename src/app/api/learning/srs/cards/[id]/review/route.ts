import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { ReviewRequest, ReviewResponse } from '@/features/learning/types';

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

  const { rating, latencyMs, idempotencyKey } = body as ReviewRequest;

  if (!rating || !latencyMs || !idempotencyKey) {
    return NextResponse.json(
      { error: '"rating", "latencyMs", and "idempotencyKey" are required' },
      { status: 400 },
    );
  }

  if (![1, 2, 3, 4].includes(rating)) {
    return NextResponse.json({ error: '"rating" must be 1, 2, 3, or 4' }, { status: 400 });
  }

  try {
    const data = await serverFetch<ReviewResponse>({
      service: 'progress',
      path: `/srs/cards/${id}/review`,
      method: 'POST',
      body: { rating, latencyMs, idempotencyKey },
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
