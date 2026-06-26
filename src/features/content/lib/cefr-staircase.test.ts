import { describe, expect, it } from 'vitest';
import { hasStabilised, nextLevel, shouldStop, MAX_ROUNDS } from './cefr-staircase';

describe('nextLevel', () => {
  it('steps up one level on a correct answer', () => {
    expect(nextLevel('B1', true)).toBe('B2');
  });

  it('steps down one level on an incorrect answer', () => {
    expect(nextLevel('B1', false)).toBe('A2');
  });

  it('clamps at the top of the scale', () => {
    expect(nextLevel('C2', true)).toBe('C2');
  });

  it('clamps at the bottom of the scale', () => {
    expect(nextLevel('A1', false)).toBe('A1');
  });
});

describe('hasStabilised', () => {
  it('is false before enough rounds have been played', () => {
    expect(hasStabilised(['B1'])).toBe(false);
    expect(hasStabilised(['B1', 'B2'])).toBe(false);
  });

  it('is false while the level keeps changing', () => {
    expect(hasStabilised(['B1', 'B2', 'B1'])).toBe(false);
  });

  it('is true once the level repeats for the stabilisation window', () => {
    expect(hasStabilised(['B1', 'B2', 'B2', 'B2'])).toBe(true);
  });
});

describe('shouldStop', () => {
  it('stops once stabilised', () => {
    expect(shouldStop(['B1', 'B2', 'B2', 'B2'])).toBe(true);
  });

  it('stops at the round cap even if still oscillating', () => {
    const oscillating: Array<'B1' | 'B2'> = Array.from({ length: MAX_ROUNDS + 1 }, (_, i) =>
      i % 2 === 0 ? 'B1' : 'B2',
    );
    expect(shouldStop(oscillating)).toBe(true);
  });

  it('continues while neither condition is met', () => {
    expect(shouldStop(['B1', 'B2', 'A2'])).toBe(false);
  });
});
