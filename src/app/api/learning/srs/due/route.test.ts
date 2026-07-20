// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { SrsCard } from '@/features/learning/types';

const MOCK_CARD: SrsCard = {
  id: 'card-1',
  status: 'due' as const,
  direction: 'forward' as const,
  front: { word: 'sykepleier', pos: 'noun', listName: 'Professions' },
  back: { definition: 'nurse', sentences: [{ target: 'Hun er sykepleier.', translation: 'She is a nurse.' }] },
  predicted: { '1': { label: '5 min' }, '2': { label: '10 min' }, '3': { label: '1 day' }, '4': { label: '4 days' } },
};

// learning-service's actual `/srs/due` response — it never includes a
// `dueCount` field; the route derives one from `cards.length`.
const MOCK_UPSTREAM = {
  dailyLimit: 20,
  reviewedToday: 3,
  cards: [MOCK_CARD],
};

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/learning/srs/due', () => {
  it('returns the SRS queue with dueCount derived from the cards array', async () => {
    vi.mocked(serverFetch).mockResolvedValue(MOCK_UPSTREAM);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...MOCK_UPSTREAM, dueCount: 1 });
    expect(serverFetch).toHaveBeenCalledWith({ service: 'progress', path: '/srs/due' });
  });

  it('derives dueCount 0 when the queue is empty', async () => {
    vi.mocked(serverFetch).mockResolvedValue({ ...MOCK_UPSTREAM, cards: [] });
    const res = await GET();
    expect(await res.json()).toMatchObject({ dueCount: 0, cards: [] });
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
