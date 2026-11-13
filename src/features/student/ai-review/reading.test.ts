import { describe, expect, it } from 'vitest';

import { readReading, transcriptionOf } from './reading';

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

  it('keeps the sounds of a word where they were named, and only whole (plan 88, step 5c)', () => {
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
              {
                text: 'kjøre',
                accuracy: 60,
                error: 'none',
                phonemes: [
                  { symbol: 'ç', accuracy: 31 },
                  { symbol: 'øː', accuracy: 88 },
                  { symbol: 'ɾ', accuracy: 90 },
                  { symbol: '', accuracy: 70 },
                ],
              },
              { text: 'bil', accuracy: 90, error: 'none', phonemes: [{ symbol: 'b' }] },
            ],
          },
        },
      ],
    });
    const prompt = reading!.prompts[0]!;
    expect(prompt.pronunciation?.words).toEqual([
      {
        text: 'kjøre',
        accuracy: 60,
        error: 'none',
        phonemes: [
          { symbol: 'ç', accuracy: 31 },
          { symbol: 'øː', accuracy: 88 },
          { symbol: 'ɾ', accuracy: 90 },
          { symbol: '', accuracy: 70 },
        ],
      },
      { text: 'bil', accuracy: 90, error: 'none' },
    ]);

    expect(transcriptionOf(prompt, { wordIndex: 0, fragment: 'kjøre' })).toBe('çøːɾ?');
    // Not named, not quoting back, or no word at all: nothing to draw.
    expect(transcriptionOf(prompt, { wordIndex: 1, fragment: 'bil' })).toBeNull();
    expect(transcriptionOf(prompt, { wordIndex: 0, fragment: 'bil' })).toBeNull();
    expect(transcriptionOf(prompt, { wordIndex: null, fragment: 'kjøre' })).toBeNull();
    expect(transcriptionOf(null, { wordIndex: 0, fragment: 'kjøre' })).toBeNull();
  });

  it('is null for anything that is not a reading', () => {
    expect(readReading(null)).toBeNull();
    expect(readReading(undefined)).toBeNull();
    expect(readReading({ prompts: [] })).toBeNull();
    expect(readReading([])).toBeNull();
  });
});
