import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PersonalWord } from '../types';
import { introduceWord, removeMyWord } from './client';

const word = (ownWord: boolean) =>
  ({ entryId: 'e1', vocabularyItemId: 'item-1', ownWord, word: 'gjerne' }) as PersonalWord;

/** Answers by path; records every call in order. */
function mockFetch(answers: Record<string, { status?: number; body?: unknown }>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      const answer = answers[url] ?? {};
      const status = answer.status ?? 200;
      return new Response(status === 204 ? null : JSON.stringify(answer.body ?? {}), { status });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('removeMyWord', () => {
  it('suspends the card of a word of one’s own', async () => {
    const calls = mockFetch({
      '/api/personal-vocabulary/e1': { status: 204 },
      '/api/learning/srs/card-states': {
        body: { states: [{ contentId: 'item-1', state: 'REVIEW' }] },
      },
      '/api/srs/cards/introduce': { body: { id: 'card-1', state: 'REVIEW' } },
    });

    await removeMyWord(word(true));

    expect(calls).toEqual([
      'DELETE /api/personal-vocabulary/e1',
      'POST /api/learning/srs/card-states',
      'POST /api/srs/cards/introduce',
      'POST /api/srs/cards/card-1/suspend',
    ]);
  });

  it('leaves a course word’s card alone', async () => {
    const calls = mockFetch({ '/api/personal-vocabulary/e1': { status: 204 } });

    await removeMyWord(word(false));

    expect(calls).toEqual(['DELETE /api/personal-vocabulary/e1']);
  });

  it('creates no card for a word that never had one', async () => {
    const calls = mockFetch({
      '/api/personal-vocabulary/e1': { status: 204 },
      '/api/learning/srs/card-states': { body: { states: [] } },
    });

    await removeMyWord(word(true));

    expect(calls).not.toContain('POST /api/srs/cards/introduce');
  });
});

describe('introduceWord', () => {
  it('brings a suspended card back', async () => {
    const calls = mockFetch({
      '/api/srs/cards/introduce': { body: { id: 'card-1', state: 'SUSPENDED' } },
    });

    await introduceWord('item-1');

    expect(calls).toContain('POST /api/srs/cards/card-1/unsuspend');
  });

  it('takes the day’s limit as no error', async () => {
    mockFetch({ '/api/srs/cards/introduce': { status: 429 } });

    await expect(introduceWord('item-1')).resolves.toBeUndefined();
  });
});
