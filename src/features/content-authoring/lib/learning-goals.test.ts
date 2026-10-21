import { describe, expect, it } from 'vitest';

import { formatLearningGoals, learningGoalsProblem, parseLearningGoals } from './learning-goals';

describe('parseLearningGoals', () => {
  it('reads one goal per line, trimmed, blank lines dropped', () => {
    expect(parseLearningGoals('  Bestille mat \n\n\t\nSpørre om prisen\n')).toEqual([
      'Bestille mat',
      'Spørre om prisen',
    ]);
  });

  it('reads an empty text as no goals', () => {
    expect(parseLearningGoals('')).toEqual([]);
  });

  it('round-trips what it formats', () => {
    const goals = ['Bestille mat', 'Spørre om prisen'];
    expect(parseLearningGoals(formatLearningGoals(goals))).toEqual(goals);
  });
});

describe('learningGoalsProblem', () => {
  it('accepts up to twenty goals of up to 300 characters', () => {
    expect(learningGoalsProblem(Array.from({ length: 20 }, () => 'x'.repeat(300)))).toBeNull();
  });

  it('refuses a twenty-first goal', () => {
    expect(learningGoalsProblem(Array.from({ length: 21 }, () => 'x'))).toBe('tooMany');
  });

  it('refuses a goal over 300 characters', () => {
    expect(learningGoalsProblem(['x'.repeat(301)])).toBe('tooLong');
  });
});
