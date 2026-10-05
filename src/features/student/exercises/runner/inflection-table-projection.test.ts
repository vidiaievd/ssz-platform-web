import { describe, expect, it } from 'vitest';

import {
  sampleContent,
  toContent,
  toExpectedAnswers,
  toStudentProjection,
  updateInput,
  updateSettings,
} from '@/lib/shared-kernel/inflection-table';

import { readInflectionTableProjection } from './inflection-table-projection';

const deal = (ex = sampleContent()) => toStudentProjection(toContent(ex), toExpectedAnswers(ex));
const clone = () => JSON.parse(JSON.stringify(deal())) as ReturnType<typeof deal>;

describe('readInflectionTableProjection', () => {
  it('reads a table as the kernel deals it, typing mode', () => {
    expect(readInflectionTableProjection(deal())).toEqual(deal());
  });

  it('reads a table as the kernel deals it, bank mode', () => {
    const bank = deal(updateInput(sampleContent(), { mode: 'bank' }));
    const read = readInflectionTableProjection(bank);
    expect(read?.bank?.length).toBeGreaterThan(0);
    expect(read).toEqual(bank);
  });

  it('keeps the first-letter hint when the author turned it on', () => {
    const hinted = deal(updateSettings(sampleContent(), { hintFirstLetter: true }));
    const read = readInflectionTableProjection(hinted);
    expect(read?.rows[0]?.cells['defSg']).toEqual({ mode: 'ask', hint: 'j' });
  });

  it('falls back to safe settings for what did not arrive', () => {
    const board = { ...clone(), settings: {} };
    expect(readInflectionTableProjection(board)?.settings).toEqual({
      input: 'type',
      attempts: 1,
      revealKey: 'afterLast',
      rowVerdict: true,
    });
  });

  it.each([
    ['not an object', 'nope'],
    ['an array', []],
    ['no rows', { ...clone(), rows: undefined }],
    ['no slots', { ...clone(), slots: undefined }],
    ['a single slot', { ...clone(), slots: clone().slots.slice(0, 1) }],
    ['a row with no lemma', { ...clone(), rows: [{ id: 'r', lemma: '', gloss: '', cells: {} }] }],
  ])('refuses %s', (_name, value) => {
    expect(readInflectionTableProjection(value)).toBeNull();
  });

  it('refuses a bank-mode table that has no bank', () => {
    const board = { ...clone(), settings: { ...clone().settings, input: 'bank' } };
    expect(readInflectionTableProjection(board)).toBeNull();
  });

  // The key is refused, never stripped (IT-X2): a runner that quietly worked on a payload
  // carrying the answers would hide that they had been sent.
  it('IT-X2: refuses an asked cell that carries its form', () => {
    const board = clone();
    board.rows[0]!.cells['defSg'] = { mode: 'ask', value: 'jobben' } as never;
    expect(readInflectionTableProjection(board)).toBeNull();
  });

  type Board = {
    rows: { dictId?: string; why?: string; cells: Record<string, Record<string, unknown>> }[];
    settings: Record<string, unknown>;
    expectedAnswers?: unknown;
  };
  it.each([
    ['accept on a cell', (b: Board) => (b.rows[0]!.cells['defSg']!['accept'] = ['x'])],
    ['why on a cell', (b: Board) => (b.rows[0]!.cells['defSg']!['why'] = 'x')],
    ['dictId on a row', (b: Board) => (b.rows[0]!.dictId = 'd')],
    ['why on a row', (b: Board) => (b.rows[0]!.why = 'x')],
    ['the pass mark', (b: Board) => (b.settings['threshold'] = 75)],
    ['an answer key', (b: Board) => (b.expectedAnswers = {})],
  ])('IT-X2: refuses %s', (_name, mutate) => {
    const board = clone() as unknown as Board;
    mutate(board);
    expect(readInflectionTableProjection(board)).toBeNull();
  });
});
