import { describe, expect, it } from 'vitest';

import { PRESETS, readyRows } from '@/lib/shared-kernel/multiple-choice-group';
import {
  exercise,
  RIGHT,
  WRONG,
} from '@/lib/shared-kernel/multiple-choice-group/fixtures.test-support';

import {
  addColumn,
  addRow,
  applyBulkPaste,
  applyPreset,
  markAnswer,
  removeColumn,
  removeRow,
  setColumn,
  setRow,
  setSettings,
  setSource,
  type MultipleChoiceGroupDocument,
} from './edits';

function doc(): MultipleChoiceGroupDocument {
  return { updatedAt: '2026-08-29T10:00:00.000Z', ...exercise() };
}

describe('multiple-choice-group edits', () => {
  it('writes a statement without touching its neighbours', () => {
    const before = doc();
    const after = setRow(before, before.rows[1]!.id, { text: 'Rewritten.' });

    expect(after.rows[1]!.text).toBe('Rewritten.');
    expect(after.rows[0]).toBe(before.rows[0]);
  });

  it('clears the answer when the marked column is clicked again', () => {
    const before = doc();
    const row = before.rows[0]!;

    expect(markAnswer(before, row.id, RIGHT.id).rows[0]!.answer).toBeNull();
    expect(markAnswer(before, row.id, WRONG.id).rows[0]!.answer).toBe(WRONG.id);
  });

  it('keeps the last row whatever the caller asks', () => {
    const one = { ...doc(), rows: [doc().rows[0]!] };

    expect(removeRow(one, one.rows[0]!.id)).toBe(one);

    const four = doc();
    expect(removeRow(four, four.rows[0]!.id).rows).toHaveLength(3);
  });

  it('nulls the answers of a deleted column', () => {
    const base = doc();
    const before = {
      ...base,
      columns: [...base.columns, { id: 'c3', label: 'Står ikke', short: '?' }],
    };
    const after = removeColumn(before, WRONG.id);

    expect(after.columns.map((c) => c.id)).toEqual([RIGHT.id, 'c3']);
    expect(after.rows.filter((r) => r.answer === null)).toHaveLength(2);
    expect(after.rows.filter((r) => r.answer === RIGHT.id)).toHaveLength(2);
  });

  it('stops adding columns at four', () => {
    let ex = doc();
    ex = addColumn(addColumn(ex));
    expect(ex.columns).toHaveLength(4);
    expect(addColumn(ex)).toBe(ex);
  });

  it('carries answers across a preset by label, and drops the rest', () => {
    // Riktig/Galt → Ja/Nei: not one label survives, so every answer goes.
    const jaNei = applyPreset(doc(), PRESETS[2]!);
    expect(jaNei.rows.every((row) => row.answer === null)).toBe(true);

    // Riktig/Galt → Riktig/Galt/Står ikke: both survive, under new ids.
    const three = applyPreset(doc(), PRESETS[1]!);
    expect(three.columns).toHaveLength(3);
    expect(readyRows(three)).toHaveLength(4);
    expect(three.rows[0]!.answer).toBe(three.columns[0]!.id);
    expect(three.rows[0]!.answer).not.toBe(RIGHT.id);
  });

  it('trims a short code to three characters', () => {
    expect(setColumn(doc(), RIGHT.id, { short: 'RIKTIG' }).columns[0]!.short).toBe('RIK');
  });

  it('leaves the short code alone when the label is renamed', () => {
    const after = setColumn(doc(), RIGHT.id, { label: 'Sant' });
    expect(after.columns[0]).toMatchObject({ label: 'Sant', short: 'R' });
  });

  it('replaces the empty rows on a bulk paste and keeps the written ones', () => {
    const before = addRow(addRow(doc()));
    const after = applyBulkPaste(before, 'Ny påstand. | G\nEn til.\n');

    expect(after.rows).toHaveLength(6);
    expect(after.rows[4]).toMatchObject({ text: 'Ny påstand.', answer: WRONG.id });
    expect(after.rows[5]).toMatchObject({ text: 'En til.', answer: null });
  });

  it('patches the source and the settings in place', () => {
    expect(setSource(doc(), { mode: 'inline' }).source).toMatchObject({ mode: 'inline', text: '' });
    expect(setSettings(doc(), { retry: 'none' }).settings.retry).toBe('none');
    expect(setSettings(doc(), { retry: 'none' }).settings.lockCorrect).toBe(true);
  });
});
