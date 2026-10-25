// @vitest-environment node

import { describe, expect, it } from 'vitest';

import type { SchoolReviewEffort } from '../types/oversight';
import { effortDraft, effortInput, effortRows, isEffortValue } from './review-effort-form';

const DATA: SchoolReviewEffort = {
  templates: [
    { templateCode: 'writing_task', minutes: 15, source: 'school' },
    { templateCode: 'read_aloud', minutes: 5, source: 'default' },
  ],
  other: { minutes: 3, source: 'default' },
  measured: {
    historyDays: 90,
    minSample: 20,
    templates: [
      { templateCode: 'writing_task', sampleSize: 31, medianMinutes: 9.5 },
      { templateCode: 'dictation', sampleSize: 4, medianMinutes: null },
    ],
  },
};

describe('the minutes-per-submission form', () => {
  it("lists the school's templates and the measured ones, each with what an empty field means", () => {
    expect(
      effortRows(DATA).map((row) => [
        row.templateCode,
        row.source,
        row.placeholder,
        row.measured?.sampleSize ?? null,
      ]),
    ).toEqual([
      ['dictation', 'other', 3, 4],
      ['read_aloud', 'default', 5, null],
      ['writing_task', 'school', null, 31],
    ]);
  });

  it("types in only the school's own figures", () => {
    expect(effortDraft(DATA)).toEqual({ templates: { writing_task: '15' }, other: '' });
  });

  it('sends a cleared field as left out, so it goes back to the factory figure', () => {
    expect(
      effortInput({ templates: { writing_task: '', read_aloud: '7', dictation: ' ' }, other: '4' }),
    ).toEqual({ templates: { read_aloud: 7 }, other: 4 });
  });

  it('accepts empty or a whole number of minutes from 1 to 120', () => {
    expect(['', '1', '120'].every(isEffortValue)).toBe(true);
    expect(['0', '121', '2.5', 'x'].some(isEffortValue)).toBe(false);
  });
});
