import { describe, expect, it } from 'vitest';

import { layerOf, type ProsodyLayer } from '@/lib/shared-kernel/prosody';
import { splitSentences } from '@/lib/shared-kernel/text/sentences';

import { acceptIn, differsIn } from './suggestion';

const TEXT = 'Bartek har jobbet i tre år. Han trives godt.';
const [first, second] = splitSentences(TEXT);

const teacher: ProsodyLayer = layerOf([
  {
    kind: 'stress',
    mark: { i: 2, w: 'jobbet', toneme: 1, vowel: { s: 1, e: 2, long: false }, source: 'teacher' },
  },
  { kind: 'boundary', mark: { i: 1, w: 'har', pitch: null, pause: 'short', source: 'teacher' } },
  { kind: 'boundary', mark: { i: 8, w: 'godt', pitch: 'fall', pause: 'long', source: 'teacher' } },
]);

const suggested: ProsodyLayer = layerOf([
  { kind: 'accent', mark: { i: 5, w: 'år', source: 'ai' } },
  { kind: 'boundary', mark: { i: 5, w: 'år', pitch: 'fall', pause: 'long', source: 'ai' } },
  { kind: 'boundary', mark: { i: 8, w: 'godt', pitch: 'fall', pause: 'long', source: 'ai' } },
]);

describe('the AI suggestion per sentence (plan 86, step 6h.3c)', () => {
  it('tells the sentences where it would change something, sources aside', () => {
    expect(differsIn(teacher, suggested, first!)).toBe(true);
    expect(differsIn(teacher, suggested, second!)).toBe(false);
  });

  it('replaces the phrase marks of one sentence and keeps everything else', () => {
    const next = acceptIn(teacher, suggested, first!);
    expect(next.stresses).toEqual(teacher.stresses);
    expect(next.accents).toEqual([{ i: 5, w: 'år', source: 'ai' }]);
    expect(next.boundaries).toEqual([
      { i: 5, w: 'år', pitch: 'fall', pause: 'long', source: 'ai' },
      { i: 8, w: 'godt', pitch: 'fall', pause: 'long', source: 'teacher' },
    ]);
  });
});
