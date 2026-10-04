import { describe, expect, it } from 'vitest';

import { paragraphOfTokens, tokenize } from '@/lib/shared-kernel/highlight-in-text';
import type { HighlightInTextSubmitDetails } from '@/features/student/exercises/types/attempts';

import { extendMark, keepExact, passageCells, toggleMark, toWire } from './highlight-in-text-marks';

// I(0) fjor(1) sommer(2) reiste(3) vi(4) til(5) Bodø(6) og(7) vi(8) gikk(9) på(10) tur(11)
// ¶ Det(12) var(13) kaldt(14) men(15) fint(16)
const TEXT = 'I fjor sommer reiste vi til Bodø, og vi gikk på tur.\n\nDet var kaldt, men fint.';
const tokens = tokenize(TEXT);
const paragraphOf = paragraphOfTokens(TEXT, tokens);

const at = (word: string) => tokens.find((t) => t.w === word)!;

function details(over: Partial<HighlightInTextSubmitDetails>): HighlightInTextSubmitDetails {
  return {
    questionId: 'q1',
    pct: 0,
    passed: false,
    exact: 0,
    near: 0,
    miss: 0,
    fp: 0,
    total: 2,
    cells: [],
    attempt: 1,
    checksLeft: null,
    closed: false,
    revealed: false,
    questions: [],
    complete: false,
    attemptPct: 0,
    attemptPassed: false,
    ...over,
  };
}

describe('toggleMark', () => {
  it('marks a single token and removes the whole mark when a token of it is pressed again (AC-S2)', () => {
    const one = toggleMark([], 3, 3, 'word', paragraphOf);
    expect(one).toEqual([{ t0: 3, t1: 3 }]);

    const phrase = toggleMark([], 0, 2, 'phrase', paragraphOf);
    expect(toggleMark(phrase, 1, 1, 'phrase', paragraphOf)).toEqual([]);
  });

  it('makes one mark over exactly the dragged tokens in a phrase question (AC-S3)', () => {
    expect(toggleMark([], 0, 3, 'phrase', paragraphOf)).toEqual([{ t0: 0, t1: 3 }]);
    // Dragged right to left: the same run.
    expect(toggleMark([], 3, 0, 'phrase', paragraphOf)).toEqual([{ t0: 0, t1: 3 }]);
  });

  it('keeps only the origin of a drag in a word question', () => {
    expect(toggleMark([], 4, 9, 'word', paragraphOf)).toEqual([{ t0: 4, t1: 4 }]);
  });

  it('cuts a drag at the paragraph it started in', () => {
    expect(toggleMark([], 10, 14, 'phrase', paragraphOf)).toEqual([{ t0: 10, t1: 11 }]);
    expect(toggleMark([], 13, 9, 'phrase', paragraphOf)).toEqual([{ t0: 12, t1: 13 }]);
  });

  it('replaces the marks a drag runs across, and keeps the rest in text order', () => {
    const marks = [
      { t0: 1, t1: 1 },
      { t0: 3, t1: 3 },
      { t0: 9, t1: 9 },
    ];
    expect(toggleMark(marks, 2, 4, 'phrase', paragraphOf)).toEqual([
      { t0: 1, t1: 1 },
      { t0: 2, t1: 4 },
      { t0: 9, t1: 9 },
    ]);
  });
});

describe('extendMark', () => {
  it('grows and shrinks the far end by one token', () => {
    const grown = extendMark([{ t0: 0, t1: 0 }], 0, 1, paragraphOf);
    expect(grown).toEqual([{ t0: 0, t1: 1 }]);
    expect(extendMark(grown, 1, -1, paragraphOf)).toEqual([{ t0: 0, t1: 0 }]);
  });

  it('never shrinks below one token, crosses a paragraph or runs into another mark', () => {
    expect(extendMark([{ t0: 0, t1: 0 }], 0, -1, paragraphOf)).toEqual([{ t0: 0, t1: 0 }]);
    expect(extendMark([{ t0: 11, t1: 11 }], 11, 1, paragraphOf)).toEqual([{ t0: 11, t1: 11 }]);
    const two = [
      { t0: 0, t1: 0 },
      { t0: 1, t1: 1 },
    ];
    expect(extendMark(two, 0, 1, paragraphOf)).toEqual(two);
  });

  it('does nothing on a token that is not marked', () => {
    expect(extendMark([{ t0: 0, t1: 0 }], 5, 1, paragraphOf)).toEqual([{ t0: 0, t1: 0 }]);
  });
});

describe('keepExact', () => {
  it('keeps exactly the marks the server called exact and clears the rest (AC-S6)', () => {
    const marks = [
      { t0: 3, t1: 3 },
      { t0: 2, t1: 2 },
      { t0: 9, t1: 9 },
    ];
    const reiste = at('reiste');
    const sommer = at('sommer');
    const gikk = at('gikk');
    const cells = [
      {
        start: sommer.s,
        end: sommer.e,
        state: 'near' as const,
        keyStart: at('fjor').s,
        keyEnd: sommer.e,
      },
      { start: reiste.s, end: reiste.e, state: 'exact' as const },
      { start: gikk.s, end: gikk.e, state: 'fp' as const },
    ];
    expect(keepExact(marks, cells, tokens)).toEqual([{ t0: 3, t1: 3 }]);
  });
});

describe('toWire', () => {
  it('sends character offsets that cover whole tokens and leave edge punctuation out', () => {
    const wire = toWire(
      [
        { t0: 6, t1: 6 },
        { t0: 0, t1: 2 },
      ],
      tokens,
    );
    expect(wire.map((r) => TEXT.slice(r.start, r.end))).toEqual(['Bodø', 'I fjor sommer']);
  });
});

describe('passageCells', () => {
  it('draws the student own marks as sel while marking', () => {
    const { cells } = passageCells([{ t0: 0, t1: 2 }], null, tokens);
    expect([0, 1, 2].map((i) => cells.get(i))).toEqual([
      { m: 'sel', k: 'm0' },
      { m: 'sel', k: 'm0' },
      { m: 'sel', k: 'm0' },
    ]);
    expect(cells.has(3)).toBe(false);
  });

  it('draws a check as the server sent it: exact → ok, fp, near with its key boundary', () => {
    const verdict = details({
      cells: [
        // the student marked «sommer», the key is «I fjor sommer»
        {
          start: at('sommer').s,
          end: at('sommer').e,
          state: 'near',
          keyStart: at('I').s,
          keyEnd: at('sommer').e,
        },
        { start: at('reiste').s, end: at('reiste').e, state: 'exact' },
        { start: at('gikk').s, end: at('gikk').e, state: 'fp' },
      ],
    });
    const { cells, numbers } = passageCells([], verdict, tokens);

    expect(cells.get(0)).toEqual({ m: 'miss', k: 'c0', keyLine: true });
    expect(cells.get(1)).toEqual({ m: 'miss', k: 'c0', keyLine: true });
    expect(cells.get(2)).toEqual({ m: 'near', k: 'c0', keyLine: true });
    expect(cells.get(3)).toEqual({ m: 'ok', k: 'c1' });
    expect(cells.get(9)).toEqual({ m: 'fp', k: 'c2' });
    expect(numbers.size).toBe(0);
  });

  it('draws the whole key with its ordinals on reveal, and nothing of the student marks', () => {
    const verdict = details({
      revealed: true,
      closed: true,
      key: [
        { n: 1, start: at('I').s, end: at('sommer').e, why: 'Tidsuttrykk.' },
        { n: 2, start: at('gikk').s, end: at('gikk').e },
      ],
    });
    const { cells, numbers } = passageCells([{ t0: 5, t1: 5 }], verdict, tokens);

    expect(cells.get(1)).toEqual({ m: 'key', k: 'key1' });
    expect(cells.get(9)).toEqual({ m: 'key', k: 'key2' });
    expect(cells.has(5)).toBe(false);
    expect([...numbers]).toEqual([
      [0, 1],
      [9, 2],
    ]);
  });
});
