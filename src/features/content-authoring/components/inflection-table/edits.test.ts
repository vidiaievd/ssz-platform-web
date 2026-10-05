import { describe, expect, it } from 'vitest';

import { readAudioDraft } from '@/lib/shared-kernel/audio';

import {
  emptyContent,
  IT_MAX_ROWS,
  type DictionaryEntry,
  type InflectionTableContent,
} from '@/lib/shared-kernel/inflection-table';

import {
  addFromDictionary,
  addManualRow,
  pickParadigm,
  setCellMode,
  setInstruction,
  toggleSlot,
  type InflectionTableDocument,
} from './edits';

const BOK: DictionaryEntry = {
  id: 'v2',
  word: 'bok',
  pos: 'NOUN',
  gloss: 'book',
  unit: 'Leksjon 2',
  properties: { gender: 'feminine', definite_singular: 'boka' },
};

const doc = (content: InflectionTableContent = emptyContent('nb')): InflectionTableDocument => ({
  ...content,
  updatedAt: '2026-10-05T10:00:00.000Z',
  audio: readAudioDraft({}, 'inflection_table'),
});

describe('inflection-table edits — the document keeps its token', () => {
  it('carries updatedAt through every edit', () => {
    let ex = doc();
    ex = setInstruction(ex, 'Bøy.');
    ex = toggleSlot(ex, 'defPl');
    ex = pickParadigm(ex, 'verb');
    ex = addManualRow(ex);
    ex = setCellMode(ex, ex.rows[0]!.id, 'pres', 'prefill');
    expect(ex.updatedAt).toBe('2026-10-05T10:00:00.000Z');
    expect(ex.paradigmId).toBe('verb');
    expect(ex.rows).toHaveLength(1);
  });

  it('adds a dictionary row over the slots in play and never twice', () => {
    const once = addFromDictionary(toggleSlot(doc(), 'defPl'), BOK);
    expect(once.rows).toHaveLength(1);
    expect(Object.keys(once.rows[0]!.cells)).toEqual(['indefSg', 'defSg', 'indefPl']);
    expect(addFromDictionary(once, BOK).rows).toHaveLength(1);
  });

  it('refuses the eleventh row', () => {
    let ex = doc();
    for (let i = 0; i < IT_MAX_ROWS; i += 1) ex = addManualRow(ex);
    expect(addFromDictionary(ex, BOK).rows).toHaveLength(IT_MAX_ROWS);
    expect(addManualRow(ex).rows).toHaveLength(IT_MAX_ROWS);
  });

  it('adds nothing without a pack', () => {
    const ex = doc(emptyContent('xx'));
    expect(addFromDictionary(ex, BOK)).toBe(ex);
  });
});
