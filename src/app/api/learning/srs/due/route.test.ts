// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { SrsCard, SrsStats } from '@/features/learning/types';

const MOCK_CARD: SrsCard = {
  id: 'card-1',
  userId: 'user-1',
  contentType: 'VOCABULARY_WORD',
  contentId: 'item-1',
  state: 'REVIEW',
  dueAt: '2026-07-27T08:00:00.000Z',
  stability: 5,
  difficulty: 5,
  scheduledDays: 3,
  reps: 2,
  lapses: 0,
  lastReviewedAt: null,
  createdAt: '2026-07-20T08:00:00.000Z',
  updatedAt: '2026-07-24T08:00:00.000Z',
  predicted: [
    { rating: 'AGAIN', scheduledDays: 0, label: '5 min' },
    { rating: 'GOOD', scheduledDays: 3, label: '3 days' },
  ],
  front: {
    word: 'sykepleier',
    partOfSpeech: 'noun',
    ipaTranscription: null,
    audioMediaId: null,
    listId: 'list-1',
  },
  back: {
    translation: 'nurse',
    alternativeTranslations: [],
    definition: null,
    usageNotes: null,
    translationLanguage: 'en',
    fallbackUsed: false,
    immersionMode: false,
    examples: [{ text: 'Hun er sykepleier.', translation: 'She is a nurse.', audioMediaId: null }],
  },
};

/** learning-service's `/srs/due` envelope — it has no `dueCount` field. */
const MOCK_UPSTREAM = {
  dailyLimit: 20,
  reviewedToday: 3,
  streakDays: 4,
  cards: [MOCK_CARD],
};

const MOCK_STATS: SrsStats = {
  newCount: 5,
  learningCount: 2,
  reviewCount: 30,
  relearningCount: 1,
  suspendedCount: 0,
  dueNowCount: 42,
  reviewedTodayCount: 3,
};

/** Resolves each upstream call by the path the route asked for. */
function mockUpstream(overrides: { due?: unknown; stats?: unknown } = {}) {
  vi.mocked(serverFetch).mockImplementation(async (opts) =>
    opts?.path === '/srs/stats/me'
      ? (overrides.stats ?? MOCK_STATS)
      : (overrides.due ?? MOCK_UPSTREAM),
  );
}

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/learning/srs/due${query}`);
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/learning/srs/due', () => {
  it('takes the due count from /srs/stats/me, not from the card sample', async () => {
    mockUpstream();

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    // One card in the sample, 42 actually due — the sample is bounded by `limit`.
    expect(await res.json()).toEqual({ ...MOCK_UPSTREAM, dueCount: 42 });
  });

  it('requests the queue with the default limit and language', async () => {
    mockUpstream();

    await GET(makeRequest());

    expect(serverFetch).toHaveBeenCalledWith({
      service: 'progress',
      path: '/srs/due',
      query: { limit: 20, language: 'en', includeExamples: true },
    });
  });

  it('forwards the requested language and caps the limit at the server maximum', async () => {
    mockUpstream();

    await GET(makeRequest('?limit=500&language=ru'));

    expect(serverFetch).toHaveBeenCalledWith({
      service: 'progress',
      path: '/srs/due',
      query: { limit: 100, language: 'ru', includeExamples: true },
    });
  });

  it('reports zero due when the backlog is empty', async () => {
    mockUpstream({
      due: { ...MOCK_UPSTREAM, cards: [] },
      stats: { ...MOCK_STATS, dueNowCount: 0 },
    });

    const res = await GET(makeRequest());

    expect(await res.json()).toMatchObject({ dueCount: 0, cards: [] });
  });

  it('returns 401 on unauthenticated error', async () => {
    mockUpstream();
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'Not authenticated'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 502 on upstream failure', async () => {
    mockUpstream();
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(502);
  });
});
