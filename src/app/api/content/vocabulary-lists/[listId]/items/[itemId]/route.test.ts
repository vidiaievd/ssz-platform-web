// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const PARAMS = { params: Promise.resolve({ listId: 'list-1', itemId: 'item-1' }) };

function makeGetRequest() {
  return new NextRequest('http://localhost/api/content/vocabulary-lists/list-1/items/item-1');
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/content/vocabulary-lists/[listId]/items/[itemId]', () => {
  it('maps the backend item, including definition/forms/pronunciation audio', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce({
      id: 'item-1',
      word: 'travel',
      partOfSpeech: 'adjective',
      ipaTranscription: '/ˈtrɑːvəl/',
      pronunciationAudioMediaId: 'media-2',
      grammaticalProperties: {
        forms: [
          ['Positiv', 'travel'],
          ['Komparativ', 'travlere'],
        ],
      },
      translations: [{ language: 'en', primaryTranslation: 'busy', definition: 'having a lot to do' }],
      usageExamples: [{ id: 'ex-1', exampleText: 'Det er et travelt yrke.' }],
    });

    const res = await GET(makeGetRequest(), PARAMS);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'item-1',
      lemma: 'travel',
      partOfSpeech: 'adjective',
      ipa: '/ˈtrɑːvəl/',
      audioMediaId: 'media-2',
      forms: [
        { label: 'Positiv', value: 'travel' },
        { label: 'Komparativ', value: 'travlere' },
      ],
      translations: [{ languageCode: 'en', translation: 'busy', definition: 'having a lot to do' }],
      examples: [{ id: 'ex-1', template: 'Det er et travelt yrke.', substitution: '' }],
    });
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'content',
      path: '/vocabulary-lists/list-1/items/item-1',
    });
  });

  it('returns 404 when the item is not found', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'Item not found'));
    const res = await GET(makeGetRequest(), PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));
    const res = await GET(makeGetRequest(), PARAMS);
    expect(res.status).toBe(502);
  });
});
