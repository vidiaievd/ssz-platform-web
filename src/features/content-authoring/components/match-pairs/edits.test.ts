import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, coverage, type MatchPairs } from '@/lib/shared-kernel/match-pairs';

import {
  addDistractor,
  addPair,
  applyPaste,
  emptyPair,
  hasExplicitVariant,
  newPairId,
  newRightId,
  parsePasteLines,
  pairsFromPaste,
  distractorProblem,
  removeDistractor,
  removePair,
  reorderPairs,
  setSettings,
  setPairHalf,
  setVariant,
  setWhy,
  whyOf,
} from './edits';

function doc(overrides: Partial<MatchPairs> = {}): MatchPairs {
  return {
    id: 'ex-1',
    type: 'match_pairs',
    moduleId: 'module-1',
    title: 'Leddsetninger',
    instructions: 'Sett sammen halvdelene.',
    variant: 'halves',
    settings: { ...DEFAULT_SETTINGS },
    pairs: [
      { id: 'p1', rightId: 'h1', left: 'Hvis det regner i morgen,', right: 'blir vi hjemme.' },
      {
        id: 'p2',
        rightId: 'h2',
        left: 'Jeg rakk ikke bussen fordi',
        right: 'jeg sto opp for sent.',
      },
      { id: 'p3', rightId: 'h3', left: 'Hun sa at', right: 'hun kom senere.' },
    ],
    distractors: [{ id: 'h9', text: 'vi blir hjemme.' }],
    feedback: {},
    updatedAt: '2026-08-21T10:00:00.000Z',
    ...overrides,
  };
}

describe('ids', () => {
  it('mints pair ids and right ids from separate namespaces', () => {
    expect(newPairId()).toMatch(/^p[0-9a-f]{8}$/);
    expect(newRightId()).toMatch(/^h[0-9a-f]{8}$/);
  });

  it('never gives a new pair the same id as its own half (AC-S15, decision 2)', () => {
    const pair = emptyPair();
    expect(pair.rightId).not.toBe(pair.id);
  });
});

describe('halves and the why note', () => {
  it('writes one half without touching the other', () => {
    const next = setPairHalf(doc(), 'p1', 'right', 'blir vi hjemme likevel.');

    expect(next.pairs[0]).toMatchObject({
      left: 'Hvis det regner i morgen,',
      right: 'blir vi hjemme likevel.',
      rightId: 'h1',
    });
  });

  it('stores the why note on the pair feedback, creating the entry when there is none', () => {
    const next = setWhy(doc(), 'p1', 'Inversjon etter leddsetningen.');

    expect(whyOf(next, 'p1')).toBe('Inversjon etter leddsetningen.');
    expect(next.feedback['p1']).toMatchObject({ def: '', ov: {} });
  });

  it('keeps the default explanation and overrides when the why note changes', () => {
    const seeded = doc({
      feedback: {
        p1: { def: 'Se på ordstillingen.', why: '', ov: { h2: { text: 'Nei', origin: 'author' } } },
      },
    });

    const next = setWhy(seeded, 'p1', 'Inversjon.');

    expect(next.feedback['p1']).toEqual({
      def: 'Se på ordstillingen.',
      why: 'Inversjon.',
      ov: { h2: { text: 'Nei', origin: 'author' } },
    });
  });
});

describe('removePair', () => {
  it('deletes the pair, its feedback row and every override pointing at its half (AC-B4)', () => {
    const seeded = doc({
      feedback: {
        p1: { def: 'a', why: '', ov: { h2: { text: 'about p2 half', origin: 'author' } } },
        p2: { def: 'b', why: '', ov: { h1: { text: 'about p1 half', origin: 'author' } } },
        p3: { def: 'c', why: '', ov: { h1: { text: 'about p1 half', origin: 'author' } } },
      },
    });
    const before = coverage(seeded);

    const next = removePair(seeded, 'p1');

    expect(next.pairs.map((pair) => pair.id)).toEqual(['p2', 'p3']);
    expect(next.feedback['p1']).toBeUndefined();
    expect(next.feedback['p2']?.ov['h1']).toBeUndefined();
    expect(next.feedback['p3']?.ov['h1']).toBeUndefined();
    // Its half left the pool, so the matrix lost both a row and a column.
    expect(coverage(next).total).toBeLessThan(before.total);
  });
});

describe('reorderPairs', () => {
  it('moves the row without renumbering any stored id (AC-B3)', () => {
    const ex = doc();
    const [first, second, third] = ex.pairs;

    const next = reorderPairs(ex, [third!, first!, second!]);

    expect(next.pairs.map((pair) => pair.id)).toEqual(['p3', 'p1', 'p2']);
    expect(next.pairs.map((pair) => pair.rightId)).toEqual(['h3', 'h1', 'h2']);
  });
});

describe('parsePasteLines', () => {
  it('splits on a pipe, a tab and a spaced em dash (AC-B7)', () => {
    expect(
      parsePasteLines(
        'Hvis det regner, | blir vi hjemme.\nHun sa at\thun kom.\nJeg tror — det går bra.',
      ),
    ).toEqual([
      { left: 'Hvis det regner,', right: 'blir vi hjemme.' },
      { left: 'Hun sa at', right: 'hun kom.' },
      { left: 'Jeg tror', right: 'det går bra.' },
    ]);
  });

  it('keeps a line without a separator, with an empty right half to flag (AC-B6)', () => {
    expect(parsePasteLines('Hun sa at hun kom.')).toEqual([
      { left: 'Hun sa at hun kom.', right: '' },
    ]);
  });

  it('drops blank lines and mints no ids', () => {
    expect(parsePasteLines('\n  \na | b\n')).toEqual([{ left: 'a', right: 'b' }]);
  });

  it('gives every pasted pair its own ids', () => {
    const pairs = pairsFromPaste('a | b\nc | d');
    const ids = new Set([...pairs.map((p) => p.id), ...pairs.map((p) => p.rightId)]);

    expect(pairs).toHaveLength(2);
    expect(ids.size).toBe(4);
  });
});

describe('applyPaste', () => {
  it('appends the parsed rows and drops the cards that were still blank (AC-B7)', () => {
    const blank = emptyPair();
    const halfWritten = { ...emptyPair(), left: 'Jeg tror' };
    const ex = doc({ pairs: [blank, halfWritten] });

    const next = applyPaste(ex, 'Hvis det regner, | blir vi hjemme.');

    expect(next.pairs.map((pair) => pair.left)).toEqual(['Jeg tror', 'Hvis det regner,']);
  });

  it('changes nothing when there is nothing to parse', () => {
    const ex = doc();
    expect(applyPaste(ex, '   \n ')).toBe(ex);
  });
});

describe('variant', () => {
  it('is stored on the document', () => {
    expect(setVariant(doc(), 'pairs').variant).toBe('pairs');
  });

  it('reads an absent field as unchosen rather than as `pairs`', () => {
    expect(hasExplicitVariant({ pairs: [], settings: {} })).toBe(false);
    expect(hasExplicitVariant({ variant: 'pairs' })).toBe(true);
    expect(hasExplicitVariant({ variant: 'halves' })).toBe(true);
    expect(hasExplicitVariant({ variant: 'something else' })).toBe(false);
    expect(hasExplicitVariant(null)).toBe(false);
    expect(hasExplicitVariant(undefined)).toBe(false);
  });
});

describe('addPair', () => {
  it('appends an empty pair at the end', () => {
    const next = addPair(doc(), emptyPair());
    expect(next.pairs).toHaveLength(4);
    expect(next.pairs[3]).toMatchObject({ left: '', right: '' });
  });
});

describe('the extra halves', () => {
  it('refuses text that reads like a correct half, whatever the case or spacing', () => {
    expect(distractorProblem(doc(), '  BLIR  vi hjemme. ')).toBe('answer');
  });

  it('refuses an extra that is already in the pool', () => {
    expect(distractorProblem(doc(), 'vi blir hjemme.')).toBe('duplicate');
  });

  it('allows anything else, and blank text is not a problem to report', () => {
    expect(distractorProblem(doc(), 'vi bodde i Bergen.')).toBeNull();
    expect(distractorProblem(doc(), '   ')).toBeNull();
  });

  it('adds one extra with an id from the same generator as the answers', () => {
    const next = addDistractor(doc(), '  vi bodde i Bergen.  ');
    const added = next.distractors.at(-1)!;

    expect(added.text).toBe('vi bodde i Bergen.');
    expect(added.id).toMatch(/^h[0-9a-f]{8}$/);
  });

  it('adds nothing when the text is refused', () => {
    const ex = doc();
    expect(addDistractor(ex, 'blir vi hjemme.')).toBe(ex);
    expect(addDistractor(ex, '  ')).toBe(ex);
  });

  it('removing an extra drops every override written against it (AC-B12)', () => {
    const seeded = doc({
      feedback: {
        p1: { def: 'a', why: '', ov: { h9: { text: 'word order', origin: 'author' } } },
        p2: { def: 'b', why: '', ov: { h9: { text: 'word order', origin: 'author' } } },
      },
    });

    const next = removeDistractor(seeded, 'h9');

    expect(next.distractors).toEqual([]);
    expect(next.feedback['p1']?.ov).toEqual({});
    expect(next.feedback['p2']?.ov).toEqual({});
  });

  it('switching the extras off keeps them and their explanations (AC-B14)', () => {
    const seeded = doc({
      feedback: { p1: { def: 'a', why: '', ov: { h9: { text: 'word order', origin: 'author' } } } },
    });

    const off = setSettings(seeded, { distractors: false });

    expect(off.distractors).toHaveLength(1);
    expect(off.feedback['p1']?.ov['h9']?.text).toBe('word order');
    expect(coverage(off).total).toBe(coverage(seeded).total - 3);
    expect(coverage(setSettings(off, { distractors: true }))).toEqual(coverage(seeded));
  });
});
