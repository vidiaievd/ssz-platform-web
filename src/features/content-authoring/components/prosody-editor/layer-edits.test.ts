import { describe, expect, it } from 'vitest';

import { emptyProsodyLayer, type ProsodyLayer } from '@/lib/shared-kernel/prosody';
import { tokenize } from '@/lib/shared-kernel/text/words';

import {
  clearPhrase,
  cyclePause,
  revertWord,
  setAccent,
  setBoundary,
  setStress,
  setUnstressed,
  stressFor,
  vowelNuclei,
  wordAnswered,
} from './layer-edits';

const tokens = tokenize('Bartek har jobbet i tre år.');
const bartek = tokens[0]!;
const ar = tokens[5]!;

describe('layer edits (plan 86, step 6h.3b)', () => {
  it('sets and clears the main word, as the teacher', () => {
    const on = setAccent(emptyProsodyLayer(), ar, true);
    expect(on.accents).toEqual([{ i: 5, w: 'år', source: 'teacher' }]);
    expect(setAccent(on, ar, false).accents).toEqual([]);
  });

  it('cycles the pause after a word and keeps its pitch', () => {
    let layer: ProsodyLayer = setBoundary(emptyProsodyLayer(), ar, { pitch: 'fall' });
    expect(layer.boundaries[0]).toMatchObject({ pitch: 'fall', pause: null });
    layer = cyclePause(layer, ar);
    expect(layer.boundaries[0]).toMatchObject({ pitch: 'fall', pause: 'short' });
    layer = cyclePause(layer, ar);
    expect(layer.boundaries[0]).toMatchObject({ pause: 'long' });
    layer = cyclePause(layer, ar);
    expect(layer.boundaries[0]).toMatchObject({ pitch: 'fall', pause: null });
  });

  it('drops a group end with neither a pitch nor a pause', () => {
    const layer = cyclePause(emptyProsodyLayer(), tokens[1]!);
    expect(layer.boundaries).toHaveLength(1);
    expect(cyclePause(cyclePause(layer, tokens[1]!), tokens[1]!).boundaries).toEqual([]);
  });

  it('turns an accepted AI mark into the teacher’s once it is touched', () => {
    const layer: ProsodyLayer = {
      ...emptyProsodyLayer(),
      boundaries: [{ i: 5, w: 'år', pitch: 'fall', pause: null, source: 'ai' }],
    };
    expect(cyclePause(layer, ar).boundaries[0]?.source).toBe('teacher');
  });

  it('clears the phrase marks of a word and leaves its stress', () => {
    let layer = setStress(emptyProsodyLayer(), bartek, { s: 1, e: 2, long: null }, 1);
    layer = setAccent(layer, bartek, true);
    layer = setBoundary(layer, bartek, { pause: 'short' });
    const cleared = clearPhrase(layer, bartek);
    expect(cleared.accents).toEqual([]);
    expect(cleared.boundaries).toEqual([]);
    expect(cleared.stresses).toHaveLength(1);
  });

  it('settles a word either with a stress or «no stress», never both', () => {
    const stressed = setStress(emptyProsodyLayer(), bartek, { s: 1, e: 2, long: null }, 1);
    expect(wordAnswered(stressed, bartek)).toBe('stress');
    const bare = setUnstressed(stressed, bartek);
    expect(bare.stresses).toEqual([]);
    expect(bare.unstressed).toEqual([{ i: 0, w: 'Bartek', source: 'teacher' }]);
    expect(wordAnswered(revertWord(bare, bartek), bartek)).toBeNull();
  });

  it('keeps orphans through every edit', () => {
    const orphan = {
      kind: 'accent' as const,
      mark: { i: 9, w: 'borte', source: 'teacher' as const },
    };
    const layer: ProsodyLayer = { ...emptyProsodyLayer(), orphans: [orphan] };
    expect(setAccent(layer, ar, true).orphans).toEqual([orphan]);
    expect(revertWord(layer, ar).orphans).toEqual([orphan]);
  });

  it('reads the vowel nuclei, a diphthong as one', () => {
    expect(vowelNuclei('høyere').map((v) => 'høyere'.slice(v.s, v.e))).toEqual(['øy', 'e', 'e']);
    expect(vowelNuclei('Bartek')).toHaveLength(2);
  });

  it('gives a picked vowel the dictionary’s length and a toneme only to several syllables', () => {
    const lexicon = {
      i: 1,
      w: 'har',
      toneme: null,
      vowel: { s: 1, e: 2, long: true },
      source: 'lexicon' as const,
    };
    expect(stressFor('har', { s: 1, e: 2, long: null }, lexicon, lexicon)).toEqual({
      vowel: { s: 1, e: 2, long: true },
      toneme: null,
    });
    expect(stressFor('Bartek', { s: 4, e: 5, long: null }, undefined, undefined)).toEqual({
      vowel: { s: 4, e: 5, long: null },
      toneme: 1,
    });
  });
});
