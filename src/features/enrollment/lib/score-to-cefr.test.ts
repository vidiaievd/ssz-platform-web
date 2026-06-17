// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { scoreToCefr, cefrMinScore } from './score-to-cefr';

describe('scoreToCefr', () => {
  it.each([
    [0,   'A1'],
    [30,  'A1'],
    [31,  'A2'],
    [45,  'A2'],
    [46,  'B1'],
    [60,  'B1'],
    [61,  'B2'],
    [75,  'B2'],
    [76,  'C1'],
    [89,  'C1'],
    [90,  'C2'],
    [100, 'C2'],
  ] as const)('score %i → %s', (score, expected) => {
    expect(scoreToCefr(score)).toBe(expected);
  });
});

describe('cefrMinScore', () => {
  it('returns 0 for A1', () => expect(cefrMinScore('A1')).toBe(0));
  it('returns 31 for A2', () => expect(cefrMinScore('A2')).toBe(31));
  it('returns 90 for C2', () => expect(cefrMinScore('C2')).toBe(90));
});
