// @vitest-environment node

import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw/server';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'ssz_at' ? { value: 'test-token' } : undefined),
    set: () => undefined,
    delete: () => undefined,
  }),
  headers: async () => new Headers(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const { bulkCreateVocabularyItemsAction } = await import('./vocabulary');

describe('bulkCreateVocabularyItemsAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates one item and one translation per row, and reports the created count', async () => {
    let itemsCreated = 0;
    server.use(
      http.post('http://content.test/api/v1/vocabulary-lists/list-1/items', async ({ request }) => {
        const body = (await request.json()) as { word: string };
        itemsCreated += 1;
        return HttpResponse.json({ itemId: `item-${body.word}` }, { status: 201 });
      }),
      http.put(
        'http://content.test/api/v1/vocabulary-lists/list-1/items/:itemId/translations/en',
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const result = await bulkCreateVocabularyItemsAction(
      'list-1',
      'container-1',
      [
        { lemma: 'sykkel', translation: 'bicycle', partOfSpeech: 'noun' },
        { lemma: 'sykle', translation: 'to cycle' },
      ],
      'en',
    );

    expect(result).toEqual({ ok: true, value: { created: 2 } });
    expect(itemsCreated).toBe(2);
  });

  it('returns a validation error when there are no rows', async () => {
    const result = await bulkCreateVocabularyItemsAction('list-1', 'container-1', [], 'en');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation');
  });

  it('propagates an upstream failure', async () => {
    server.use(
      http.post('http://content.test/api/v1/vocabulary-lists/list-1/items', () =>
        HttpResponse.json({ title: 'Internal Server Error' }, { status: 500 }),
      ),
    );

    const result = await bulkCreateVocabularyItemsAction(
      'list-1',
      'container-1',
      [{ lemma: 'sykkel', translation: 'bicycle' }],
      'en',
    );

    expect(result.ok).toBe(false);
  });
});
