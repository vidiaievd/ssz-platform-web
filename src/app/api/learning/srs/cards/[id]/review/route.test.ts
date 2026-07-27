// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { ReviewResponse } from '@/features/learning/types';

const PARAMS = { params: Promise.resolve({ id: 'card-1' }) };

const VALID_BODY = {
  rating: 'GOOD' as const,
  reviewedAt: '2026-07-27T08:00:00.000Z',
  idempotencyKey: 'idem-abc',
};

/** The endpoint answers with the rescheduled card itself. */
const MOCK_REVIEW: ReviewResponse = {
  id: 'card-1',
  userId: 'user-1',
  contentType: 'VOCABULARY_WORD',
  contentId: 'item-1',
  state: 'REVIEW',
  dueAt: '2026-08-03T08:00:00.000Z',
  stability: 8.5,
  difficulty: 5,
  scheduledDays: 7,
  reps: 3,
  lapses: 0,
  lastReviewedAt: '2026-07-27T08:00:00.000Z',
  createdAt: '2026-07-20T08:00:00.000Z',
  updatedAt: '2026-07-27T08:00:00.000Z',
  predicted: [],
};

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/learning/srs/cards/card-1/review', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('POST /api/learning/srs/cards/[id]/review', () => {
  it('submits the review and returns the response', async () => {
    vi.mocked(serverFetch).mockResolvedValue(MOCK_REVIEW);
    const res = await POST(makeRequest(VALID_BODY), PARAMS);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MOCK_REVIEW);
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/srs/cards/card-1/review', method: 'POST' }),
    );
  });

  it('forwards the rating verbatim — the server takes the string enum', async () => {
    vi.mocked(serverFetch).mockResolvedValue(MOCK_REVIEW);

    await POST(makeRequest(VALID_BODY), PARAMS);

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          rating: 'GOOD',
          reviewedAt: '2026-07-27T08:00:00.000Z',
          idempotencyKey: 'idem-abc',
        },
      }),
    );
  });

  it('returns 400 when rating is missing', async () => {
    const res = await POST(makeRequest({ idempotencyKey: 'k' }), PARAMS);
    expect(res.status).toBe(400);
  });

  it('rejects the numeric rating this route used to send', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, rating: 3 }), PARAMS);
    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('returns 400 for an unknown rating', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, rating: 'PERFECT' }), PARAMS);
    expect(res.status).toBe(400);
  });

  it('returns 429 when daily limit is reached', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('rate_limited', 'Daily limit reached'));
    const res = await POST(makeRequest(VALID_BODY), PARAMS);
    expect(res.status).toBe(429);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'Not authenticated'));
    const res = await POST(makeRequest(VALID_BODY), PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));
    const res = await POST(makeRequest(VALID_BODY), PARAMS);
    expect(res.status).toBe(502);
  });
});
