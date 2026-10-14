import { describe, expect, it } from 'vitest';

import { nextSkipped, nextUnreached, unansweredCount } from './short-answer-walk';

describe('walking a short_answer set with skips', () => {
  const ids = ['q1', 'q2', 'q3', 'q4'];

  it('goes forward to the next question not reached yet', () => {
    expect(nextUnreached(ids, 0, { answered: ['q1'], skipped: [] })).toBe(1);
    expect(nextUnreached(ids, 1, { answered: ['q1'], skipped: ['q2'] })).toBe(2);
  });

  it('wraps to an earlier question never reached — a set resumed mid-way', () => {
    expect(nextUnreached(ids, 3, { answered: ['q3', 'q4'], skipped: [] })).toBe(0);
  });

  it('has nowhere to go once every question is answered or skipped', () => {
    expect(nextUnreached(ids, 3, { answered: ['q1', 'q3'], skipped: ['q2', 'q4'] })).toBeNull();
  });

  it('goes back to the next skipped question, not to the one just skipped again', () => {
    const walk = { answered: ['q1', 'q3'], skipped: ['q2', 'q4'] };
    expect(nextSkipped(ids, 3, walk)).toBe(1);
    expect(nextSkipped(ids, 1, walk)).toBe(3);
  });

  it('comes back to the same question when it is the only one skipped', () => {
    expect(nextSkipped(ids, 1, { answered: ['q1', 'q3', 'q4'], skipped: ['q2'] })).toBe(1);
  });

  it('counts what the set would be sent without', () => {
    expect(unansweredCount(ids, { answered: ['q1', 'q3'], skipped: ['q2'] })).toBe(2);
    expect(unansweredCount(ids, { answered: ids, skipped: [] })).toBe(0);
  });
});
