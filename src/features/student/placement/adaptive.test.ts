import { describe, it, expect } from 'vitest';
import {
  PLACEMENT_LEVELS,
  PLACEMENT_START_INDEX,
  PLACEMENT_QUESTION_COUNT,
  DEFAULT_LEVEL_TO_MODULE,
  nextLevelIndex,
  directionFor,
  levelIdAt,
  computePlacementResult,
} from './adaptive';

describe('PLACEMENT_LEVELS', () => {
  it('contains exactly 4 levels in CEFR order', () => {
    expect(PLACEMENT_LEVELS).toEqual(['A1', 'A2', 'B1', 'B2']);
    expect(PLACEMENT_LEVELS).toHaveLength(4);
  });
});

describe('PLACEMENT_START_INDEX', () => {
  it('starts at A2 (index 1)', () => {
    expect(PLACEMENT_START_INDEX).toBe(1);
    expect(PLACEMENT_LEVELS[PLACEMENT_START_INDEX]).toBe('A2');
  });
});

describe('PLACEMENT_QUESTION_COUNT', () => {
  it('is 5', () => {
    expect(PLACEMENT_QUESTION_COUNT).toBe(5);
  });
});

describe('nextLevelIndex', () => {
  it('steps up on a correct answer', () => {
    expect(nextLevelIndex(1, true)).toBe(2);
  });

  it('steps down on an incorrect answer', () => {
    expect(nextLevelIndex(2, false)).toBe(1);
  });

  it('clamps at max (B2 = index 3) on correct', () => {
    expect(nextLevelIndex(3, true)).toBe(3);
  });

  it('clamps at min (A1 = index 0) on incorrect', () => {
    expect(nextLevelIndex(0, false)).toBe(0);
  });

  it('steps through all levels correctly', () => {
    expect(nextLevelIndex(0, true)).toBe(1);  // A1 → A2
    expect(nextLevelIndex(1, true)).toBe(2);  // A2 → B1
    expect(nextLevelIndex(2, true)).toBe(3);  // B1 → B2
    expect(nextLevelIndex(3, false)).toBe(2); // B2 → B1
    expect(nextLevelIndex(2, false)).toBe(1); // B1 → A2
    expect(nextLevelIndex(1, false)).toBe(0); // A2 → A1
  });
});

describe('directionFor', () => {
  it('returns "up" when the index increases', () => {
    expect(directionFor(1, 2)).toBe('up');
    expect(directionFor(0, 3)).toBe('up');
  });

  it('returns "down" when the index decreases', () => {
    expect(directionFor(2, 1)).toBe('down');
    expect(directionFor(3, 0)).toBe('down');
  });

  it('returns null when the index is unchanged', () => {
    expect(directionFor(2, 2)).toBeNull();
    expect(directionFor(0, 0)).toBeNull();
  });
});

describe('levelIdAt', () => {
  it.each([
    [0, 'A1'],
    [1, 'A2'],
    [2, 'B1'],
    [3, 'B2'],
  ] as const)('index %i → %s', (index, expected) => {
    expect(levelIdAt(index)).toBe(expected);
  });
});

describe('computePlacementResult', () => {
  it('uses DEFAULT_LEVEL_TO_MODULE by default', () => {
    expect(computePlacementResult(1)).toEqual({ levelId: 'A2', moduleIndex: 3 });
  });

  it('maps all default levels correctly', () => {
    expect(computePlacementResult(0)).toEqual({ levelId: 'A1', moduleIndex: DEFAULT_LEVEL_TO_MODULE.A1 });
    expect(computePlacementResult(1)).toEqual({ levelId: 'A2', moduleIndex: DEFAULT_LEVEL_TO_MODULE.A2 });
    expect(computePlacementResult(2)).toEqual({ levelId: 'B1', moduleIndex: DEFAULT_LEVEL_TO_MODULE.B1 });
    expect(computePlacementResult(3)).toEqual({ levelId: 'B2', moduleIndex: DEFAULT_LEVEL_TO_MODULE.B2 });
  });

  it('respects a per-course module mapping override', () => {
    const custom = { A1: 1, A2: 2, B1: 3, B2: 4 };
    expect(computePlacementResult(2, custom)).toEqual({ levelId: 'B1', moduleIndex: 3 });
    expect(computePlacementResult(3, custom)).toEqual({ levelId: 'B2', moduleIndex: 4 });
  });
});
