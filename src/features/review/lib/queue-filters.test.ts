import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FILTERS,
  hasActiveFilters,
  parseQueueFilters,
  queueFiltersToApiQuery,
  queueFiltersToQuery,
} from './queue-filters';

describe('parseQueueFilters', () => {
  it('reads a whole view out of the address bar', () => {
    const filters = parseQueueFilters(
      new URLSearchParams('groupBy=student&group=g1&course=c1&type=writing_task&overdue=true'),
    );

    expect(filters).toEqual({
      groupBy: 'student',
      group: 'g1',
      course: 'c1',
      type: 'writing_task',
      overdueOnly: true,
    });
  });

  it('reads the same view out of a server component searchParams object', () => {
    expect(parseQueueFilters({ groupBy: 'student', overdue: 'true' })).toMatchObject({
      groupBy: 'student',
      overdueOnly: true,
    });
  });

  it('falls back rather than breaking on a stale link', () => {
    const filters = parseQueueFilters(new URLSearchParams('groupBy=sideways&type=made_up'));
    expect(filters.groupBy).toBe('exercise');
    expect(filters.type).toBeNull();
  });

  it('is the default view when the address carries nothing', () => {
    expect(parseQueueFilters(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
  });
});

describe('queueFiltersToQuery', () => {
  it('leaves defaults out, so one view has one link', () => {
    expect(queueFiltersToQuery(DEFAULT_FILTERS)).toBe('');
    expect(queueFiltersToQuery({ ...DEFAULT_FILTERS, groupBy: 'exercise' })).toBe('');
  });

  it('round-trips through the address bar', () => {
    const filters = {
      groupBy: 'student' as const,
      group: 'g1',
      course: 'c1',
      type: 'short_answer' as const,
      overdueOnly: true,
    };
    expect(parseQueueFilters(new URLSearchParams(queueFiltersToQuery(filters)))).toEqual(filters);
  });

  it('keeps the open submission across a filter change', () => {
    expect(queueFiltersToQuery(DEFAULT_FILTERS, 'att-1')).toBe('?submission=att-1');
  });
});

describe('hasActiveFilters', () => {
  it('does not count the grouping, which narrows nothing', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, groupBy: 'student' })).toBe(false);
  });

  it('counts anything that hides work', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, overdueOnly: true })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, course: 'c1' })).toBe(true);
  });
});

describe('queueFiltersToApiQuery', () => {
  it('always states the grouping, since the BFF groups the answer', () => {
    expect(queueFiltersToApiQuery('oslo-skole', DEFAULT_FILTERS)).toBe(
      'school=oslo-skole&groupBy=exercise',
    );
  });
});
