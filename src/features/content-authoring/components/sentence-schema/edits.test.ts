import { describe, expect, it, vi } from 'vitest';

import {
  chunk,
  content,
  field,
  row,
  schema,
} from '@/lib/shared-kernel/sentence-schema/fixtures.test-support';
import { isDeliverable, type SentenceSchemaContent } from '@/lib/shared-kernel/sentence-schema';

import {
  addExtra,
  addField,
  addRow,
  applyBulkPaste,
  applyPreset,
  assignChunk,
  hasPlacements,
  joinAt,
  moveField,
  removeExtra,
  removeField,
  removeRow,
  setChunkNote,
  setField,
  setRowClause,
  setRowSource,
  setRowText,
  setSettings,
  setWhy,
  splitAt,
  toggleAlt,
  toggleClause,
  unassignChunk,
} from './edits';

/** `crypto.randomUUID` is not in every test environment, and every id here is minted. */
vi.stubGlobal('crypto', {
  ...globalThis.crypto,
  randomUUID: () => `${Math.random().toString(36).slice(2, 10)}-0000-0000-0000-000000000000`,
});

const doc = (overrides: Partial<SentenceSchemaContent> = {}) => content(overrides);

describe('sentence-schema edits · schema', () => {
  it('clears every placement when the pack is switched — the ids are new', () => {
    const before = doc();
    expect(hasPlacements(before)).toBe(true);

    const after = applyPreset(before, 'nb-simple');

    expect(after.presetId).toBe('nb-simple');
    expect(hasPlacements(after)).toBe(false);
    // The words survive; only the claim about where they go is gone.
    expect(after.rows[0]!.chunks.map((c) => c.text)).toEqual(
      before.rows[0]!.chunks.map((c) => c.text),
    );
  });

  it('leaves the sentences of a clause type working when the type is switched off', () => {
    const after = toggleClause(doc(), 'main');

    expect(after.clauses).toEqual([]);
    expect(isDeliverable(after.rows[0]!)).toBe(true);
  });

  it('moves a field without touching a placement — order is display only', () => {
    const after = moveField(doc(), 'main', 'v', -1);

    expect(after.schema.main.map((f) => f.id)).toEqual(['v', 'F', 'n', 'a', 'V', 'N']);
    expect(after.rows[0]!.chunks.find((c) => c.id === 'c2')!.field).toBe('v');
  });

  it('refuses to move the first field further left', () => {
    const before = doc();
    expect(moveField(before, 'main', 'F', -1).schema.main).toEqual(before.schema.main);
  });

  it('unplaces every chunk of a deleted field, and drops it from the alternatives', () => {
    const before = doc({
      rows: [row({ chunks: [chunk('c1', 'I morgen', 'F', ['a']), chunk('c2', 'skal', 'v')] })],
    });

    const after = removeField(before, 'main', 'a');

    expect(after.schema.main.some((f) => f.id === 'a')).toBe(false);
    expect(after.rows[0]!.chunks[0]!.alt).toEqual([]);
    expect(after.rows[0]!.chunks[0]!.field).toBe('F');
  });

  it('makes a sentence undeliverable when its field is deleted — the quiet half', () => {
    const after = removeField(doc(), 'main', 'F');

    expect(isDeliverable(after.rows[0]!)).toBe(false);
    expect(after.rows[0]!.chunks[0]!.field).toBeNull();
  });

  it('appends a field keyed by its position and free to stay empty', () => {
    const after = addField(doc(), 'main', 'New field');
    const added = after.schema.main.at(-1)!;

    expect(added.short).toBe('7');
    expect(added.optional).toBe(true);
  });

  it('renames a field without disturbing what is in it', () => {
    const after = setField(doc(), 'main', 'F', { label: 'Fundament' });

    expect(after.schema.main[0]!.label).toBe('Fundament');
    expect(after.rows[0]!.chunks[0]!.field).toBe('F');
  });
});

describe('sentence-schema edits · sentences', () => {
  it('carries a placement through a typo fix', () => {
    const after = setRowText(doc(), 'r1', 'I morgen skal jeg ikke lese bok');
    const chunks = after.rows[0]!.chunks;

    expect(chunks.slice(0, 5).map((c) => c.field)).toEqual(['F', 'v', 'n', 'a', 'V']);
    // The word that changed loses its placement, and only that one.
    expect(chunks.at(-1)!.text).toBe('bok');
    expect(chunks.at(-1)!.field).toBeNull();
  });

  it('clears the placements of a sentence whose clause type changes', () => {
    const after = setRowClause(doc(), 'r1', 'sub');

    expect(after.rows[0]!.clause).toBe('sub');
    expect(after.rows[0]!.chunks.every((c) => c.field === null)).toBe(true);
  });

  it('keeps the source sentence out of the chunks entirely', () => {
    const after = setRowSource(doc(), 'r1', 'Jeg skal lese boka i morgen');

    expect(after.rows[0]!.source).toBe('Jeg skal lese boka i morgen');
    expect(after.rows[0]!.chunks.map((c) => c.text)).toEqual(
      doc().rows[0]!.chunks.map((c) => c.text),
    );
  });

  it('drops a field from the alternatives when the chunk is placed there', () => {
    const before = doc({ rows: [row({ chunks: [chunk('c1', 'I morgen', 'F', ['a', 'N'])] })] });

    const after = assignChunk(before, 'r1', 'c1', 'a');

    expect(after.rows[0]!.chunks[0]!.field).toBe('a');
    expect(after.rows[0]!.chunks[0]!.alt).toEqual(['N']);
  });

  it('takes the alternatives away with the placement when a chunk comes off the board', () => {
    const before = doc({ rows: [row({ chunks: [chunk('c1', 'I morgen', 'F', ['a'])] })] });

    const after = unassignChunk(before, 'r1', 'c1');

    expect(after.rows[0]!.chunks[0]).toMatchObject({ field: null, alt: [] });
  });

  it('toggles an alternative field on and back off', () => {
    const once = toggleAlt(doc(), 'r1', 'c1', 'a');
    expect(once.rows[0]!.chunks[0]!.alt).toEqual(['a']);
    expect(toggleAlt(once, 'r1', 'c1', 'a').rows[0]!.chunks[0]!.alt).toEqual([]);
  });

  it('joins two chunks into one element, keeping the left one', () => {
    const before = doc({
      rows: [row({ chunks: [chunk('c1', 'I', 'F'), chunk('c2', 'morgen', 'a')] })],
    });

    const after = joinAt(before, 'r1', 0);

    expect(after.rows[0]!.chunks).toHaveLength(1);
    expect(after.rows[0]!.chunks[0]).toMatchObject({ id: 'c1', text: 'I morgen', field: 'F' });
  });

  it('splits a joined chunk back, each word inheriting the field', () => {
    const after = splitAt(doc(), 'r1', 0);

    expect(after.rows[0]!.chunks.slice(0, 2).map((c) => [c.text, c.field])).toEqual([
      ['I', 'F'],
      ['morgen', 'F'],
    ]);
  });

  it('trims an extra and ignores a blank one', () => {
    const after = addExtra(addExtra(doc(), 'r1', '  ikke  '), 'r1', '   ');

    expect(after.rows[0]!.extras.map((e) => e.text)).toEqual(['ikke']);
    expect(removeExtra(after, 'r1', after.rows[0]!.extras[0]!.id).rows[0]!.extras).toEqual([]);
  });

  it('adds and removes sentences', () => {
    const added = addRow(doc(), 'main');
    expect(added.rows).toHaveLength(2);
    expect(removeRow(added, 'r1').rows.map((r) => r.text)).toEqual(['']);
  });

  it('drops the blank card a paste lands on, and maps segments to fields in order', () => {
    const before = doc({ rows: [row({ id: 'blank', text: '', chunks: [] })] });

    const after = applyBulkPaste(before, 'I morgen | skal | jeg', 'main');

    expect(after.rows).toHaveLength(1);
    expect(after.rows[0]!.chunks.map((c) => [c.text, c.field])).toEqual([
      ['I', 'F'],
      ['morgen', 'F'],
      ['skal', 'v'],
      ['jeg', 'n'],
    ]);
  });

  it('mints fresh ids for pasted rows so two pastes cannot share a key', () => {
    const once = applyBulkPaste(doc({ rows: [] }), 'skal | jeg', 'main');
    const twice = applyBulkPaste(once, 'skal | jeg', 'main');

    expect(twice.rows[0]!.id).not.toBe(twice.rows[1]!.id);
    expect(twice.rows[0]!.chunks[0]!.id).not.toBe(twice.rows[1]!.chunks[0]!.id);
  });

  it('honours a clause prefix in a paste against that clause’s own fields', () => {
    const before = doc({
      clauses: ['main', 'sub'],
      schema: { ...schema(), sub: [field('k', 'k', 'Konjunksjon'), field('sn', 'n', 'Subjekt')] },
      rows: [],
    });

    const after = applyBulkPaste(before, 'sub :: fordi | jeg', 'main');

    expect(after.rows[0]!.clause).toBe('sub');
    expect(after.rows[0]!.chunks.map((c) => c.field)).toEqual(['k', 'sn']);
  });
});

describe('sentence-schema edits · difficulty and feedback', () => {
  it('patches one setting and leaves the other eight', () => {
    const after = setSettings(doc(), { order: 'loose' });

    expect(after.settings.order).toBe('loose');
    expect(after.settings.shuffle).toBe(true);
  });

  it('deletes an emptied chunk note rather than storing a blank one', () => {
    const written = setChunkNote(doc(), 'r1', 'c1', 'Bare ett ledd i forfeltet.');
    expect(written.rows[0]!.fb).toEqual({ c1: 'Bare ett ledd i forfeltet.' });

    expect(setChunkNote(written, 'r1', 'c1', '   ').rows[0]!.fb).toEqual({});
  });

  it('writes the rule for one sentence only', () => {
    const two = addRow(doc(), 'main');
    const after = setWhy(two, 'r1', 'V2.');

    expect(after.rows[0]!.why).toBe('V2.');
    expect(after.rows[1]!.why).toBe('');
  });
});
