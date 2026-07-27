// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { SrsStats } from '@/features/learning/types';

const MOCK_STATS: SrsStats = {
  newCount: 5,
  learningCount: 2,
  reviewCount: 142,
  relearningCount: 1,
  suspendedCount: 0,
  dueNowCount: 12,
  reviewedTodayCount: 8,
};

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/learning/srs/stats', () => {
  it('returns stats on success', async () => {
    vi.mocked(serverFetch).mockResolvedValue(MOCK_STATS);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MOCK_STATS);
    expect(serverFetch).toHaveBeenCalledWith({ service: 'progress', path: '/srs/stats/me' });
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'Not authenticated'));
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));
    const res = await GET();
    expect(res.status).toBe(502);
  });
});
