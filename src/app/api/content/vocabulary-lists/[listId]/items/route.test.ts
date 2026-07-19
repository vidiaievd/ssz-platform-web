// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const PARAMS = { params: Promise.resolve({ listId: 'list-1' }) };

function makeGetRequest(query = '') {
  return new NextRequest(`http://localhost/api/content/vocabulary-lists/list-1/items${query}`);
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/content/vocabulary-lists/[listId]/items', () => {
  it('maps backend items, surfacing definition/forms/pronunciation audio', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce({
      items: [{ id: 'item-1', word: 'sykepleier', partOfSpeech: 'noun', ipaTranscription: '/ˈsyːkəˌplɛɪər/' }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    vi.mocked(serverFetch).mockResolvedValueOnce({
      id: 'item-1',
      word: 'sykepleier',
      partOfSpeech: 'noun',
      ipaTranscription: '/ˈsyːkəˌplɛɪər/',
      pronunciationAudioMediaId: 'media-1',
      grammaticalProperties: {
        forms: [
          ['Ubestemt entall', 'en sykepleier'],
          ['Bestemt entall', 'sykepleieren'],
        ],
      },
      translations: [
        { language: 'en', primaryTranslation: 'nurse', definition: 'a person who cares for the sick' },
      ],
      usageExamples: [{ id: 'ex-1', exampleText: 'Marta er sykepleier.' }],
    });

    const res = await GET(makeGetRequest(), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([
      {
        id: 'item-1',
        lemma: 'sykepleier',
        partOfSpeech: 'noun',
        ipa: '/ˈsyːkəˌplɛɪər/',
        audioMediaId: 'media-1',
        forms: [
          { label: 'Ubestemt entall', value: 'en sykepleier' },
          { label: 'Bestemt entall', value: 'sykepleieren' },
        ],
        translations: [{ languageCode: 'en', translation: 'nurse', definition: 'a person who cares for the sick' }],
        examples: [{ id: 'ex-1', template: 'Marta er sykepleier.', substitution: '' }],
      },
    ]);
  });

  it('omits forms when grammaticalProperties has no recognized shape', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce({
      items: [{ id: 'item-1', word: 'jobbe', partOfSpeech: 'verb', ipaTranscription: null }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    vi.mocked(serverFetch).mockResolvedValueOnce({
      id: 'item-1',
      word: 'jobbe',
      partOfSpeech: 'verb',
      ipaTranscription: null,
      grammaticalProperties: { gender: 'neuter' },
      translations: [],
      usageExamples: [],
    });

    const res = await GET(makeGetRequest(), PARAMS);
    const body = await res.json();
    expect(body.items[0].forms).toBeUndefined();
    expect(body.items[0].audioMediaId).toBeUndefined();
  });

  it('returns an empty page when the list is not found', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'List not found'));
    const res = await GET(makeGetRequest(), PARAMS);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], total: 0, page: 1, limit: 0, totalPages: 0 });
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));
    const res = await GET(makeGetRequest(), PARAMS);
    expect(res.status).toBe(502);
  });
});
