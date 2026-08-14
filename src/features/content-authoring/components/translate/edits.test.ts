import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AI,
  DEFAULT_CHECK,
  DEFAULT_FLOW,
  DEFAULT_LANGS,
  type Item,
  type Translate,
} from '@/lib/shared-kernel/translate';

import {
  addGloss,
  addItem,
  addRef,
  duplicateItem,
  emptyItem,
  removeGloss,
  removeItem,
  removeRef,
  setDirection,
  setGloss,
  setItem,
  setRef,
  swapLangs,
} from './edits';

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    dir: 'to_target',
    source: 'Я живу в Тромсё три года.',
    refs: ['Jeg har bodd i Tromsø i tre år.'],
    gloss: [],
    require: [],
    forbid: [],
    ...overrides,
  };
}

function doc(overrides: Partial<Translate> = {}): Translate {
  return {
    id: 'ex-1',
    type: 'translate_to_target',
    moduleId: 'module-1',
    title: '',
    instructions: 'Oversett setningene.',
    dir: 'to_target',
    langs: { ...DEFAULT_LANGS },
    format: 'set',
    note: '',
    items: [item()],
    check: { ...DEFAULT_CHECK },
    flow: { ...DEFAULT_FLOW },
    ai: { ...DEFAULT_AI },
    updatedAt: '2026-08-14T10:00:00.000Z',
    ...overrides,
  };
}

describe('translate builder edits', () => {
  it('starts a new sentence with one empty key line', () => {
    const fresh = emptyItem('from_target');

    expect(fresh.dir).toBe('from_target');
    expect(fresh.refs).toEqual(['']);
    expect(fresh.id).not.toBe('');
  });

  it('adds, duplicates and removes sentences without touching the rest', () => {
    const one = doc();
    const two = addItem(one, emptyItem('to_target'));
    expect(two.items).toHaveLength(2);
    expect(one.items).toHaveLength(1);

    const copied = duplicateItem(two, 'i1');
    expect(copied.items).toHaveLength(3);
    // Right after the original, with its own id and its own arrays.
    expect(copied.items[1]!.source).toBe(one.items[0]!.source);
    expect(copied.items[1]!.id).not.toBe('i1');
    expect(copied.items[1]!.refs).not.toBe(one.items[0]!.refs);

    expect(removeItem(copied, 'i1').items.some((each) => each.id === 'i1')).toBe(false);
  });

  it('edits one accepted translation by position', () => {
    const next = setRef(addRef(doc(), 'i1'), 'i1', 1, 'Jeg bodde i Tromsø i tre år.');

    expect(next.items[0]!.refs).toEqual([
      'Jeg har bodd i Tromsø i tre år.',
      'Jeg bodde i Tromsø i tre år.',
    ]);
  });

  /**
   * The card has no way back from an item with no key lines at all — the blocker it
   * creates has no field to fix it in.
   */
  it('leaves an empty key line behind rather than no line at all', () => {
    const next = removeRef(doc(), 'i1', 0);

    expect(next.items[0]!.refs).toEqual(['']);
  });

  it('keeps glosses in the order the author added them', () => {
    const withOne = addGloss(doc(), 'i1', { w: 'уже', t: 'allerede' });
    const withTwo = addGloss(withOne, 'i1', { w: 'три', t: 'tre' });
    const edited = setGloss(withTwo, 'i1', 0, { t: 'allerede / nå' });

    expect(edited.items[0]!.gloss).toEqual([
      { w: 'уже', t: 'allerede / nå' },
      { w: 'три', t: 'tre' },
    ]);
    expect(removeGloss(edited, 'i1', 0).items[0]!.gloss).toEqual([{ w: 'три', t: 'tre' }]);
  });

  it('swaps the language labels and nothing else', () => {
    const next = swapLangs(doc());

    expect(next.langs).toEqual({ explain: 'Norsk', target: 'Russisk' });
    expect(next.dir).toBe('to_target');
    expect(next.items[0]!.dir).toBe('to_target');
  });

  /**
   * A per-item direction is only read when the set is mixed. Left behind, it would decide
   * which way each sentence reads the moment the author switches to `both` — silently.
   */
  it('brings every sentence along when the set is no longer mixed', () => {
    const mixed = doc({
      dir: 'both',
      items: [item(), item({ id: 'i2', dir: 'from_target' })],
    });

    const settled = setDirection(mixed, 'from_target');
    expect(settled.items.map((each) => each.dir)).toEqual(['from_target', 'from_target']);

    // Going the other way leaves the per-item directions alone — they are what `both` means.
    const back = setDirection(settled, 'both');
    expect(back.items.map((each) => each.dir)).toEqual(['from_target', 'from_target']);
  });

  it('patches one sentence and leaves its siblings identical', () => {
    const two = doc({ items: [item(), item({ id: 'i2' })] });
    const next = setItem(two, 'i2', { hint: 'Perfektum.' });

    expect(next.items[1]!.hint).toBe('Perfektum.');
    expect(next.items[0]).toBe(two.items[0]);
  });
});
