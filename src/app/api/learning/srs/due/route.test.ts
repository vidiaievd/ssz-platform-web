// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { SrsDueResponse } from '@/features/learning/types';

const MOCK_DUE: SrsDueResponse = {
  dueCount: 12,
  dailyLimit: 20,
  reviewedToday: 3,
  cards: [
    {
      id: 'card-1',
      status: 'due' as const,
      direction: 'forward' as const,
      front: { word: 'sykepleier', pos: 'noun', listName: 'Professions' },
      back: { definition: 'nurse', sentences: [{ target: 'Hun er sykepleier.', translation: 'She is a nurse.' }] },
      predicted: { '1': { label: '5 min' }, '2': { label: '10 min' }, '3': { label: '1 day' }, '4': { label: '4 days' } },
    },
  ],
};

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/learning/srs/due', () => {
  it('returns the SRS queue on success', async () => {
    vi.mocked(serverFetch).mockResolvedValue(MOCK_DUE);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MOCK_DUE);
    expect(serverFetch).toHaveBeenCalledWith({ service: 'progress', path: '/srs/due' });
  });

  it('returns 401 on unauthenticated error', async () => {
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
