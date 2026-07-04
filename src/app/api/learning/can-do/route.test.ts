// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { CanDoResponse } from '@/features/learning/types';

const MOCK_CAN_DO: CanDoResponse = {
  items: [
    {
      id: 'cdo-1',
      descriptor: 'I can describe my job in Norwegian.',
      cefrLevel: 'B1',
      moduleId: 'mod-1',
      evidenceCount: 3,
      unlockedAt: '2026-07-01T00:00:00Z',
      state: 'unlocked',
    },
    {
      id: 'cdo-2',
      descriptor: 'I can write a formal email.',
      cefrLevel: 'B1',
      moduleId: 'mod-2',
      evidenceCount: 1,
      state: 'in-progress',
    },
  ],
};

function makeRequest(search = '') {
  return new NextRequest(`http://localhost/api/learning/can-do${search}`);
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/learning/can-do', () => {
  it('returns can-do items on success', async () => {
    vi.mocked(serverFetch).mockResolvedValue(MOCK_CAN_DO);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MOCK_CAN_DO);
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/learning/can-do', query: undefined }),
    );
  });

  it('passes courseId query param when provided', async () => {
    vi.mocked(serverFetch).mockResolvedValue(MOCK_CAN_DO);
    await GET(makeRequest('?courseId=course-1'));
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ query: { courseId: 'course-1' } }),
    );
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'Not authenticated'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(502);
  });
});
