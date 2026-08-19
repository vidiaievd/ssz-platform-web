import { describe, expect, it } from 'vitest';

import { groupByLesson } from './group-by-lesson';
import type { MySubmission } from '../types';

const at = (hours: number) => new Date(Date.parse('2026-08-19T12:00:00Z') - hours * 3_600_000);

function submission(overrides: Partial<MySubmission> = {}): MySubmission {
  return {
    id: 'att-1',
    exerciseId: 'ex-1',
    exerciseTitle: 'Familien',
    course: 'Ny i Norge — A2',
    lesson: 'Leksjon 19',
    containerId: 'course-1',
    submittedAt: at(0).toISOString(),
    status: 'pending',
    attemptNo: 1,
    expectedResponseBy: null,
    decision: null,
    canResubmit: false,
    ...overrides,
  };
}

describe('grouping a learner’s list by lesson', () => {
  it('collects a lesson handed in at one sitting under one heading', () => {
    const groups = groupByLesson([
      submission({ id: 'a', submittedAt: at(0).toISOString() }),
      submission({ id: 'b', submittedAt: at(0.1).toISOString() }),
      submission({ id: 'c', submittedAt: at(0.2).toISOString() }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(groups[0]!.lesson).toBe('Leksjon 19');
  });

  it('keeps different lessons apart', () => {
    const groups = groupByLesson([
      submission({ id: 'a' }),
      submission({ id: 'b', lesson: 'Leksjon 20' }),
    ]);

    expect(groups.map((group) => group.lesson)).toEqual(['Leksjon 19', 'Leksjon 20']);
  });

  it('keeps the same lesson name apart when it belongs to another course', () => {
    const groups = groupByLesson([
      submission({ id: 'a' }),
      submission({ id: 'b', course: 'Norsk B1' }),
    ]);

    expect(groups).toHaveLength(2);
  });

  /** Coming back to a lesson a month later is separate work, not a late row of the first. */
  it('starts a new group when the same lesson is revisited much later', () => {
    const groups = groupByLesson([
      submission({ id: 'a', submittedAt: at(0).toISOString() }),
      submission({ id: 'b', submittedAt: at(30 * 24).toISOString() }),
    ]);

    expect(groups).toHaveLength(2);
  });

  /** Neighbours, not "everything of this lesson": something else in between is a break. */
  it('does not reach across a submission from another lesson', () => {
    const groups = groupByLesson([
      submission({ id: 'a' }),
      submission({ id: 'b', lesson: 'Leksjon 20' }),
      submission({ id: 'c' }),
    ]);

    expect(groups.map((group) => group.items.length)).toEqual([1, 1, 1]);
  });

  it('never folds two submissions together on the strength of a missing lesson', () => {
    const groups = groupByLesson([
      submission({ id: 'a', lesson: null }),
      submission({ id: 'b', lesson: null }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('gives an empty list no groups at all', () => {
    expect(groupByLesson([])).toEqual([]);
  });
});
