import { describe, expect, it } from 'vitest';

import { readSentenceSchemaProjection } from './sentence-schema-projection';

/**
 * The reader's job is to refuse, not to clean up. A projection that arrives with the key
 * on it means an engine older than phase 2 of plan 52 — and stripping the key here would
 * leave a runner that works, an exercise that is pointless, and nothing on any screen to
 * say the answers were ever sent.
 */
const projection = {
  title: 'Indirekte tale',
  instruction: 'Bygg om setningen.',
  rows: [
    {
      id: 'r1',
      clause: 'sub',
      fields: [
        { id: 'f-sub', short: 'sub', label: 'Subjunksjon', hint: '', optional: false },
        { id: 'f-v', short: 'v', label: 'Verbal', hint: '', optional: false },
      ],
      bank: [
        { id: 'c1', text: 'at' },
        { id: 'c2', text: 'kommer' },
      ],
      source: '«Jeg kommer», sa han.',
      counts: null,
      start: {},
    },
  ],
  settings: {
    labels: true,
    hints: false,
    counts: false,
    prefill: 'none',
    markEmpty: false,
    perField: true,
    hintAfterMistake: true,
    shuffle: true,
    extras: true,
    order: 'strict',
  },
};

describe('readSentenceSchemaProjection', () => {
  it('reads the set the server sent', () => {
    const set = readSentenceSchemaProjection(projection);

    expect(set?.rows).toHaveLength(1);
    expect(set?.rows[0]?.bank.map((item) => item.text)).toEqual(['at', 'kommer']);
    expect(set?.rows[0]?.source).toBe('«Jeg kommer», sa han.');
    expect(set?.settings.order).toBe('strict');
  });

  it('refuses a row that arrived with its chunks — those carry the field of each piece', () => {
    const leaked = {
      ...projection,
      rows: [{ ...projection.rows[0], chunks: [{ id: 'c1', text: 'at', field: 'f-sub' }] }],
    };

    expect(readSentenceSchemaProjection(leaked)).toBeNull();
  });

  it('refuses a row that arrived with its sentence — that is the word order, written out', () => {
    const leaked = { ...projection, rows: [{ ...projection.rows[0], text: 'at han kommer' }] };

    expect(readSentenceSchemaProjection(leaked)).toBeNull();
  });

  it('refuses a row that arrived with the rule or the notes', () => {
    expect(
      readSentenceSchemaProjection({
        ...projection,
        rows: [{ ...projection.rows[0], why: 'Verbet står etter subjektet.' }],
      }),
    ).toBeNull();
    expect(
      readSentenceSchemaProjection({
        ...projection,
        rows: [{ ...projection.rows[0], fb: { c1: 'Subjunksjonen står først.' } }],
      }),
    ).toBeNull();
  });

  it('refuses a bank whose pieces say where they belong', () => {
    // The likeliest shape for a leak: the key arriving one word at a time.
    const leaked = {
      ...projection,
      rows: [
        {
          ...projection.rows[0],
          bank: [{ id: 'c1', text: 'at', field: 'f-sub', alt: [] }],
        },
      ],
    };

    expect(readSentenceSchemaProjection(leaked)).toBeNull();
  });

  it('refuses a document that is not a set at all', () => {
    // Plan 52 §8 Q7 left none behind, so one arriving is a leftover — and a board drawn
    // from it would look like an exercise with nothing in it.
    expect(
      readSentenceSchemaProjection({
        sentence: 'I morgen skal jeg reise.',
        fields: [{ id: 'forfelt', label: 'Forfelt' }],
        tokens: [{ id: 't1', text: 'I morgen' }],
      }),
    ).toBeNull();
  });

  it('reads the counts only when the server sent them', () => {
    expect(readSentenceSchemaProjection(projection)?.rows[0]?.counts).toBeNull();

    const counted = {
      ...projection,
      rows: [{ ...projection.rows[0], counts: { 'f-sub': 1, 'f-v': 1 } }],
    };
    expect(readSentenceSchemaProjection(counted)?.rows[0]?.counts).toEqual({
      'f-sub': 1,
      'f-v': 1,
    });
  });

  it('falls back to the author’s own defaults for a setting that did not arrive', () => {
    const set = readSentenceSchemaProjection({ ...projection, settings: {} });

    expect(set?.settings.labels).toBe(true);
    expect(set?.settings.order).toBe('strict');
    expect(set?.settings.prefill).toBe('none');
  });

  it('takes the starting board as sent — a prefilled first piece is not a leak', () => {
    const prefilled = {
      ...projection,
      rows: [{ ...projection.rows[0], start: { 'f-sub': ['c1'] } }],
      settings: { ...projection.settings, prefill: 'first' },
    };

    expect(readSentenceSchemaProjection(prefilled)?.rows[0]?.start).toEqual({ 'f-sub': ['c1'] });
  });
});
