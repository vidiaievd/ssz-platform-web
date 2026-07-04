// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { SrsStats } from '@/features/learning/types';

const MOCK_STATS: SrsStats = {
  retentionRate: 0.87,
  matureCount: 142,
  youngCount: 23,
  totalDue: 12,
  heatmap: [
    { date: '2026-07-01', count: 15 },
    { date: '2026-07-02', count: 8 },
    { date: '2026-07-03', count: 0 },
  ],
};

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/learning/srs/stats', () => {
  it('returns stats on success', async () => {
    vi.mocked(serverFetch).mockResolvedValue(MOCK_STATS);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MOCK_STATS);
    expect(serverFetch).toHaveBeenCalledWith({ service: 'progress', path: '/srs/stats' });
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
