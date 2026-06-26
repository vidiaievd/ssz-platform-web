import type { DifficultyLevel } from '../types';

export const CEFR_LEVELS: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const STAIRCASE_START_LEVEL: DifficultyLevel = 'B1';

/** Stop once the level hasn't changed for this many consecutive rounds. */
const STABILISATION_ROUNDS = 2;

/** Hard cap so a learner who keeps flip-flopping isn't stuck forever. */
export const MAX_ROUNDS = 8;

export function nextLevel(current: DifficultyLevel, wasCorrect: boolean): DifficultyLevel {
  const index = CEFR_LEVELS.indexOf(current);
  const nextIndex = wasCorrect
    ? Math.min(index + 1, CEFR_LEVELS.length - 1)
    : Math.max(index - 1, 0);
  return CEFR_LEVELS[nextIndex]!;
}

/**
 * A round is "stable" when it didn't change the level from the previous one.
 * `levels` is the sequence of levels asked at, oldest first (including the
 * starting level), one entry per round answered so far.
 */
export function hasStabilised(levels: DifficultyLevel[]): boolean {
  if (levels.length < STABILISATION_ROUNDS + 1) return false;
  const tail = levels.slice(-(STABILISATION_ROUNDS + 1));
  return tail.every((level) => level === tail[0]);
}

export function shouldStop(levels: DifficultyLevel[]): boolean {
  return levels.length - 1 >= MAX_ROUNDS || hasStabilised(levels);
}
