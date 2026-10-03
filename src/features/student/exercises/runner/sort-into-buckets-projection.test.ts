import { describe, expect, it } from 'vitest';

import { readSortIntoBucketsProjection } from './sort-into-buckets-projection';

const BOARD = {
  instruction: 'Sorter ordene.',
  buckets: [
    { id: 'b-en', label: 'en' },
    { id: 'b-ei', label: 'ei', hint: 'Feminine nouns' },
    { id: 'none', label: 'Ingen av delene' },
  ],
  items: [
    { id: 'i1', text: 'bok' },
    { id: 'i2', text: 'bil', mediaId: 'm-1' },
  ],
  settings: { showRemaining: true, revealKey: false, attempts: 2, threshold: 80 },
};

const clone = () => JSON.parse(JSON.stringify(BOARD)) as typeof BOARD;

describe('readSortIntoBucketsProjection', () => {
  it('reads a board as the engine deals it', () => {
    expect(readSortIntoBucketsProjection(BOARD)).toEqual(BOARD);
  });

  it('falls back to the author defaults for settings that did not arrive', () => {
    const board = { ...clone(), settings: {} };
    expect(readSortIntoBucketsProjection(board)?.settings).toEqual({
      showRemaining: false,
      revealKey: true,
      attempts: 0,
      threshold: 70,
    });
  });

  it.each([
    ['not an object', 'nope'],
    ['an array', []],
    ['no buckets', { ...clone(), buckets: undefined }],
    ['no items', { ...clone(), items: undefined }],
    ['a single bucket', { ...clone(), buckets: [{ id: 'a', label: 'a' }] }],
    ['a blank tile', { ...clone(), items: [{ id: 'i1', text: '  ' }] }],
    ['a bucket with no label', { ...clone(), buckets: [{ id: 'a', label: '' }, BOARD.buckets[1]] }],
  ])('refuses %s', (_name, value) => {
    expect(readSortIntoBucketsProjection(value)).toBeNull();
  });

  // The key is refused, never stripped (plan 66 §3.2): a runner that quietly worked on a
  // payload carrying the answers would hide that they had been sent.
  it.each([
    [
      'a tile carrying its bucket',
      (b: typeof BOARD) => Object.assign(b.items[0]!, { bucketId: 'b-en' }),
    ],
    ['a tile carrying `also`', (b: typeof BOARD) => Object.assign(b.items[0]!, { also: ['b-ei'] })],
    [
      'a tile carrying its why',
      (b: typeof BOARD) => Object.assign(b.items[0]!, { why: 'because' }),
    ],
    [
      'a zone carrying its rule',
      (b: typeof BOARD) => Object.assign(b.buckets[0]!, { rule: 'en-words' }),
    ],
    ['the feedback map', (b: typeof BOARD) => Object.assign(b, { fb: {} })],
  ])('refuses a board with %s', (_name, leak) => {
    const board = clone();
    leak(board);
    expect(readSortIntoBucketsProjection(board)).toBeNull();
  });
});
