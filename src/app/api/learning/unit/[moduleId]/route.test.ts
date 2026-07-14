// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { ExpandedModule, ModuleProgress } from '@/features/learning/types';

const PARAMS = { params: Promise.resolve({ moduleId: 'mod-1' }) };

const MOCK_MODULE: ExpandedModule = {
  id: 'mod-1',
  title: 'På kafé',
  position: 1,
  cefrLevel: 'A2',
  lesson: {
    id: 'lesson-1',
    title: 'Reading: At the café',
    bodyMarkdown: '# På kafé\n\nJeg vil gjerne ha en kaffe.',
    audioUrl: 'https://cdn.example.com/audio/lesson-1.mp3',
    estimatedMinutes: 8,
  },
  vocabulary: [],
  grammar: {
    id: 'g-1',
    title: 'Indefinite articles',
    explanation: 'Norwegian has two indefinite articles: **en** and **et**.',
    examples: [{ target: 'en kaffe', translation: 'a coffee' }],
  },
  exercises: [{ id: 'ex-1', type: 'MULTIPLE_CHOICE' }],
  canDoDescriptors: [
    {
      id: 'cd-1',
      descriptor: 'Can order a drink in Norwegian',
      cefrLevel: 'A2',
      moduleId: 'mod-1',
      evidenceCount: 0,
      state: 'locked',
    },
  ],
};

/**
 * Content-service emits vocab items under `vocabItems` with different field
 * names; the BFF maps them into `vocabulary` (ExpandedVocabItem). We attach this
 * to the module the fetcher resolves, mirroring the real upstream shape.
 */
const MODULE_WITH_VOCAB_ITEMS = {
  ...MOCK_MODULE,
  vocabItems: [
    {
      id: 'v-1',
      word: 'gutt',
      partOfSpeech: 'NOUN', // Prisma enum name; BFF normalises to 'noun'
      ipaTranscription: '/ɡʉtː/',
      pronunciationAudioMediaId: 'media-1',
      grammaticalProperties: {
        gender: 'masculine',
        plural_form: 'gutter',
        definite_singular: 'gutten',
        definite_plural: 'guttene',
      },
      translation: { language: 'en', text: 'boy', definition: null },
      usageExample: { text: 'Gutten leser en bok.' },
    },
  ],
};

const EXPECTED_VOCABULARY = [
  {
    id: 'v-1',
    word: 'gutt',
    pos: 'noun',
    ipa: '/ɡʉtː/',
    translation: 'boy',
    example: 'Gutten leser en bok.',
    grammaticalProperties: {
      gender: 'masculine',
      plural_form: 'gutter',
      definite_singular: 'gutten',
      definite_plural: 'guttene',
    },
  },
];

const MOCK_PROGRESS: ModuleProgress = {
  moduleId: 'mod-1',
  status: 'in_progress',
  completedLessons: 1,
  totalLessons: 3,
};

function makeRequest() {
  return new NextRequest('http://localhost/api/learning/unit/mod-1');
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/learning/unit/[moduleId]', () => {
  it('returns the combined unit payload on success', async () => {
    vi.mocked(serverFetch)
      .mockResolvedValueOnce(MOCK_MODULE)
      .mockResolvedValueOnce(MOCK_PROGRESS);

    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.module).toEqual(MOCK_MODULE);
    expect(body.progress).toEqual(MOCK_PROGRESS);
  });

  it('maps content-service vocabItems into web vocabulary (with grammatical forms)', async () => {
    vi.mocked(serverFetch)
      .mockResolvedValueOnce(MODULE_WITH_VOCAB_ITEMS)
      .mockResolvedValueOnce(MOCK_PROGRESS);

    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.module.vocabulary).toEqual(EXPECTED_VOCABULARY);
    // The raw upstream `vocabItems` key is stripped, not leaked to the client.
    expect(body.module.vocabItems).toBeUndefined();
  });

  it('fires both upstream calls (2 total)', async () => {
    vi.mocked(serverFetch)
      .mockResolvedValueOnce(MOCK_MODULE)
      .mockResolvedValueOnce(MOCK_PROGRESS);

    await GET(makeRequest(), PARAMS);
    expect(vi.mocked(serverFetch)).toHaveBeenCalledTimes(2);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'Not authenticated'));
    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 404 when the module is not found', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'Module not found'));
    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));
    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(502);
  });
});
