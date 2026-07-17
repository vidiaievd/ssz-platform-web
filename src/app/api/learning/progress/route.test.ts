// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { ProgressRecord } from '@/features/learning/types';

const VALID_BODY = {
  contentType: 'LESSON',
  contentId: 'lesson-1',
  timeSpentSeconds: 42,
  completed: true,
};

const MOCK_PROGRESS: ProgressRecord = {
  id: 'progress-1',
  userId: 'user-1',
  contentRef: { type: 'LESSON', id: 'lesson-1' },
  status: 'COMPLETED',
  attemptsCount: 1,
  lastAttemptAt: '2026-07-17T08:00:00Z',
  timeSpentSeconds: 42,
  score: null,
  completedAt: '2026-07-17T08:00:00Z',
  needsReviewSince: null,
  reviewResolvedAt: null,
};

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/learning/progress', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('POST /api/learning/progress', () => {
  it('upserts progress and returns the response', async () => {
    vi.mocked(serverFetch).mockResolvedValue(MOCK_PROGRESS);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MOCK_PROGRESS);
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/progress', method: 'POST', body: expect.objectContaining(VALID_BODY) }),
    );
  });

  it('returns 400 when contentType is missing', async () => {
    const res = await POST(makeRequest({ contentId: 'lesson-1', timeSpentSeconds: 1, completed: true }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when completed is missing', async () => {
    const res = await POST(makeRequest({ contentType: 'LESSON', contentId: 'lesson-1', timeSpentSeconds: 1 }));
    expect(res.status).toBe(400);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'Not authenticated'));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it('returns 404 when the content item is not found', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'Content not found'));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(404);
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
  });
});
