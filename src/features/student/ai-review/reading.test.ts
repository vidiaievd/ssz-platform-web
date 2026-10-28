import { describe, expect, it } from 'vitest';

import { readReading } from './reading';

/** As the engine keeps it on a `voice_review` review (`readingForView`). */
const ENGINE = {
  passPercent: 85,
  prompts: [
    {
      itemId: 'p1',
      transcript: 'jeg bor på oslo',
      words: [{ text: 'jeg', startMs: 0, endMs: 300, confidence: 0.9 }],
      audioMs: 2400,
      pronunciation: null,
      check: {
        ops: [
          { k: 'read', i: 0, n: 1, heard: 'jeg', focus: false },
          { k: 'misread', i: 1, expected: 'i', heard: 'på', focus: true },
          { k: 'missed', i: 2, expected: 'nå', focus: false },
          { k: 'extra', heard: 'eh' },
          { k: 'shout', heard: 'ignored' },
        ],
        total: 3,
        read: 1,
        misread: 1,
        missed: 1,
        extra: 1,
        accuracy: 0.333,
      },
      percent: 33,
      passed: false,
      wordsPerMinute: 120,
    },
    { itemId: 'broken' },
  ],
  carriedItemIds: ['p0', 7],
};

describe('readReading (plan 82, step 11)', () => {
  it('copies what the screens draw and nothing else', () => {
    expect(readReading(ENGINE)).toEqual({
      passPercent: 85,
      prompts: [
        {
          itemId: 'p1',
          transcript: 'jeg bor på oslo',
          ops: [
            { k: 'read', i: 0, n: 1, heard: 'jeg', focus: false },
            { k: 'misread', i: 1, expected: 'i', heard: 'på', focus: true },
            { k: 'missed', i: 2, expected: 'nå', focus: false },
            { k: 'extra', heard: 'eh' },
          ],
          total: 3,
          read: 1,
          percent: 33,
          passed: false,
          pronunciation: null,
          wordsPerMinute: 120,
        },
      ],
      carriedItemIds: ['p0'],
    });
  });

  it('keeps pronunciation scores and drops words it cannot read', () => {
    const reading = readReading({
      ...ENGINE,
      prompts: [
        {
          ...ENGINE.prompts[0],
          pronunciation: {
            accuracy: 80,
            fluency: 70,
            completeness: 90,
            words: [
              { text: 'jeg', accuracy: 92, error: 'none' },
              { text: 'bor', accuracy: 'high', error: 'none' },
              { text: 'i', accuracy: 30, error: 'whatever' },
            ],
          },
        },
      ],
    });
    expect(reading?.prompts[0]?.pronunciation).toEqual({
      accuracy: 80,
      fluency: 70,
      completeness: 90,
      prosody: null,
      words: [{ text: 'jeg', accuracy: 92, error: 'none' }],
    });
  });

  it('is null for anything that is not a reading', () => {
    expect(readReading(null)).toBeNull();
    expect(readReading(undefined)).toBeNull();
    expect(readReading({ prompts: [] })).toBeNull();
    expect(readReading([])).toBeNull();
  });
});
