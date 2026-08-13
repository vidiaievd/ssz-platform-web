import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AI,
  DEFAULT_CHECK,
  DEFAULT_FLOW,
  DEFAULT_HINTS,
  spans,
  type ErrorCorrection,
  type Item,
} from '@/lib/shared-kernel/error-correction';

import {
  addItem,
  duplicateItem,
  emptyItem,
  parseAlts,
  removeItem,
  setItem,
  setSpanOverride,
} from './edits';

const item = (id: string, wrong: string, ref: string): Item => ({
  id,
  wrong,
  ref,
  alts: [],
  meta: {},
});

function doc(items: Item[]): ErrorCorrection {
  return {
    id: 'ex-1',
    type: 'error_correction',
    moduleId: 'module-1',
    title: '',
    instructions: 'Finn feilen.',
    mode: 'sentences',
    note: '',
    items,
    hints: { ...DEFAULT_HINTS },
    check: { ...DEFAULT_CHECK },
    flow: { ...DEFAULT_FLOW },
    ai: { ...DEFAULT_AI },
    updatedAt: '2026-08-12T10:00:00.000Z',
  };
}

const PAIR = item('i1', 'I går jeg gikk på kino.', 'I går gikk jeg på kino.');

describe('error-correction edits', () => {
  it('rewrites one item and leaves the others identical', () => {
    const before = doc([PAIR, item('i2', 'Hun har kjøp en bil.', 'Hun har kjøpt en bil.')]);

    const after = setItem(before, 'i1', { wrong: 'I går jeg gikk hjem.' });

    expect(after.items[0]!.wrong).toBe('I går jeg gikk hjem.');
    // Reference equality per item is what the autosave's dirty check reads.
    expect(after.items[1]).toBe(before.items[1]);
    expect(before.items[0]!.wrong).toBe('I går jeg gikk på kino.');
  });

  it('writes an override onto the key the kernel derived', () => {
    const before = doc([PAIR]);
    const key = spans(PAIR, before.check)[0]!.key;

    const after = setSpanOverride(before, 'i1', key, { type: 'order', note: 'V2.' });

    const span = spans(after.items[0]!, after.check)[0]!;
    expect(span.type).toBe('order');
    expect(span.note).toBe('V2.');
    expect(span.soft).toBe(false);
  });

  it('merges into an existing override rather than replacing it', () => {
    const before = doc([PAIR]);
    const key = spans(PAIR, before.check)[0]!.key;

    const withNote = setSpanOverride(before, 'i1', key, { note: 'V2.' });
    const alsoSoft = setSpanOverride(withNote, 'i1', key, { soft: true });

    const span = spans(alsoSoft.items[0]!, alsoSoft.check)[0]!;
    expect(span.note).toBe('V2.');
    expect(span.soft).toBe(true);
  });

  it('leaves an override behind when the sentence it explained changes', () => {
    // Deliberate: the key is derived from the span, so an override on a mistake that no
    // longer exists simply stops applying — and comes back if the sentence comes back.
    const before = doc([PAIR]);
    const key = spans(PAIR, before.check)[0]!.key;
    const explained = setSpanOverride(before, 'i1', key, { note: 'V2.' });

    const rewritten = setItem(explained, 'i1', { wrong: 'I går jeg dro på kino.' });
    expect(spans(rewritten.items[0]!, rewritten.check)[0]!.note).toBe('');

    const restored = setItem(rewritten, 'i1', { wrong: PAIR.wrong });
    expect(spans(restored.items[0]!, restored.check)[0]!.note).toBe('V2.');
  });

  it('duplicates an item next to the original, with its own id and its overrides', () => {
    const before = doc([PAIR, item('i2', 'Hun har kjøp en bil.', 'Hun har kjøpt en bil.')]);
    const key = spans(PAIR, before.check)[0]!.key;
    const explained = setSpanOverride(before, 'i1', key, { note: 'V2.' });

    const after = duplicateItem(explained, 'i1');

    // Right after the original, not at the end of the list.
    expect(after.items.map((each) => each.id)).toEqual(['i1', after.items[1]!.id, 'i2']);
    expect(['i1', 'i2']).not.toContain(after.items[1]!.id);
    expect(after.items[1]!.wrong).toBe(PAIR.wrong);
    expect(spans(after.items[1]!, after.check)[0]!.note).toBe('V2.');
    // A copy that shared the original's `meta` object would carry every later edit too.
    expect(after.items[1]!.meta).not.toBe(after.items[0]!.meta);
  });

  it('adds and removes items', () => {
    const fresh = emptyItem();
    const added = addItem(doc([PAIR]), fresh);
    expect(added.items).toHaveLength(2);
    expect(added.items[1]!.wrong).toBe('');

    expect(removeItem(added, 'i1').items.map((each) => each.id)).toEqual([fresh.id]);
  });

  it('reads the alternatives field a line at a time, dropping the blank ones', () => {
    expect(parseAlts('Jeg liker det.\n\n  Jeg elsker det.  \n')).toEqual([
      'Jeg liker det.',
      'Jeg elsker det.',
    ]);
    expect(parseAlts('   ')).toEqual([]);
  });
});
