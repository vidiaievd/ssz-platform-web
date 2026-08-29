import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS } from '@/lib/shared-kernel/multiple-choice-group';

import { readMultipleChoiceGroupProjection } from './multiple-choice-group-projection';

/** The table as the server projects it: statements, columns, and no trace of the key. */
const PROJECTION = {
  instruction: 'Riktig eller galt?',
  source: { mode: 'inline', label: 'Tekst 1A', text: 'Bartek søker ny jobb.' },
  columns: [
    { id: 'c-r', label: 'Riktig' },
    { id: 'c-g', label: 'Galt' },
  ],
  rows: [
    { id: 'r1', text: 'Bartek er fornøyd med jobben sin.' },
    { id: 'r2', text: 'Bartek har søkt på en ny stilling.' },
  ],
  settings: {
    numbering: true,
    layout: 'auto',
    retry: 'one',
    progress: true,
    showText: true,
    passThreshold: 70,
  },
};

const read = (patch: Record<string, unknown> = {}) =>
  readMultipleChoiceGroupProjection({ ...PROJECTION, ...patch });

describe('readMultipleChoiceGroupProjection', () => {
  it('reads the projection as sent, keeping the server order of the rows', () => {
    const table = read();

    expect(table?.rows.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(table?.columns.map((c) => c.label)).toEqual(['Riktig', 'Galt']);
    expect(table?.source.text).toBe('Bartek søker ny jobb.');
    expect(table?.settings.passThreshold).toBe(70);
  });

  it('refuses a row carrying the key', () => {
    expect(read({ rows: [{ id: 'r1', text: 'Bartek er fornøyd.', answer: 'c-g' }] })).toBeNull();
  });

  it("refuses a row carrying the author's line or the quote that proves it", () => {
    // A quote is the line of the passage that proves the statement — the answer written
    // in the author's own words, and as much a leak as the column id.
    expect(
      read({ rows: [{ id: 'r1', text: 'Bartek er fornøyd.', why: 'Han vil bytte.' }] }),
    ).toBeNull();
    expect(
      read({ rows: [{ id: 'r1', text: 'Bartek er fornøyd.', quote: 'søker ny jobb' }] }),
    ).toBeNull();
  });

  it('refuses a document of the old form, which has items and never rows', () => {
    expect(
      readMultipleChoiceGroupProjection({
        context: 'Tekst 1A',
        items: [{ id: 'i1', question: 'Bartek er fornøyd.' }],
      }),
    ).toBeNull();
  });

  it('refuses a table with fewer than two columns', () => {
    expect(read({ columns: [{ id: 'c-r', label: 'Riktig' }] })).toBeNull();
  });

  it('refuses a row with no text and a column with no label', () => {
    expect(read({ rows: [{ id: 'r1', text: '  ' }] })).toBeNull();
    expect(
      read({
        columns: [
          { id: 'c-r', label: '' },
          { id: 'c-g', label: 'Galt' },
        ],
      }),
    ).toBeNull();
  });

  it('accepts an empty table — the runner has an empty state for it', () => {
    expect(read({ rows: [] })?.rows).toEqual([]);
  });

  it('withholds the passage when the server did not send one', () => {
    // `showText: false` is applied server-side by omitting the text, rather than sending
    // it with a flag saying "do not draw this".
    const table = read({ source: { mode: 'inline', label: 'Tekst 1A' } });
    expect(table?.source.text).toBeUndefined();
    expect(table?.source.mode).toBe('inline');
  });

  it('falls back to the author defaults for settings it was not sent', () => {
    const table = read({ settings: { layout: 'nonsense' } });

    expect(table?.settings.numbering).toBe(DEFAULT_SETTINGS.numbering);
    expect(table?.settings.retry).toBe(DEFAULT_SETTINGS.retry);
    expect(table?.settings.passThreshold).toBe(DEFAULT_SETTINGS.passThreshold);
    expect(table?.settings.layout).toBe('auto');
  });

  it('refuses anything that is not a table at all', () => {
    expect(readMultipleChoiceGroupProjection(null)).toBeNull();
    expect(readMultipleChoiceGroupProjection([])).toBeNull();
    expect(readMultipleChoiceGroupProjection({ rows: [] })).toBeNull();
  });
});
