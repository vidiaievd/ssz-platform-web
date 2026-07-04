// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { ReviewResponse } from '@/features/learning/types';

const PARAMS = { params: Promise.resolve({ id: 'card-1' }) };

const VALID_BODY = { rating: 3, latencyMs: 1200, idempotencyKey: 'idem-abc' };

const MOCK_REVIEW: ReviewResponse = {
  nextDueAt: '2026-07-10T08:00:00Z',
  intervalLabel: '7 days',
  streakDays: 6,
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

  it('returns 400 when rating is missing', async () => {
    const res = await POST(makeRequest({ latencyMs: 1000, idempotencyKey: 'k' }), PARAMS);
    expect(res.status).toBe(400);
  });

  it('returns 400 when rating is out of range', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, rating: 5 }), PARAMS);
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
