import { describe, expect, it } from 'vitest';

import type { ReviewQueueGroup, ReviewQueueItem, ReviewQueueResponse } from '../types';

import { mergeQueuePages } from './queue-pages';

function item(id: string, overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
  return {
    id,
    student: { id: `u-${id}`, name: null, groupName: null },
    exerciseId: 'e1',
    exerciseTitle: 'Oversett setningene',
    submittedAt: '2026-08-19T09:00:00.000Z',
    ageHours: 3,
    overdue: false,
    attemptNo: 1,
    autoClean: false,
    lock: null,
    ...overrides,
  };
}

function group(key: string, items: ReviewQueueItem[], overrides: Partial<ReviewQueueGroup> = {}) {
  return {
    key,
    kind: 'exercise' as const,
    title: key,
    path: null,
    slaHours: 48,
    count: items.length,
    ages: items.map((one) => one.ageHours),
    overdue: items.filter((one) => one.overdue).length,
    autoCleanIds: items.filter((one) => one.autoClean).map((one) => one.id),
    items,
    ...overrides,
  };
}

function page(
  groups: ReviewQueueGroup[],
  overrides: Partial<ReviewQueueResponse> = {},
): ReviewQueueResponse {
  return {
    summary: {
      pending: 30,
      overdue: groups.reduce((total, one) => total + one.overdue, 0),
      overduePartial: false,
      oldestHours: 50,
    },
    facets: { groups: [{ id: 'g1', name: 'B1 mandag' }], courses: [] },
    groups,
    nextCursor: null,
    ...overrides,
  };
}

describe('mergeQueuePages', () => {
  it('is an empty queue before anything has been fetched', () => {
    expect(mergeQueuePages([])).toEqual({
      summary: { pending: 0, overdue: 0, overduePartial: false, oldestHours: null },
      facets: { groups: [], courses: [] },
      groups: [],
      nextCursor: null,
    });
  });

  it('joins a group that straddles a page boundary instead of showing it twice', () => {
    const merged = mergeQueuePages([
      page([group('ex-1', [item('a', { overdue: true }), item('b', { autoClean: true })])], {
        nextCursor: 'more',
      }),
      page([group('ex-1', [item('c', { ageHours: 9 })])]),
    ]);

    expect(merged.groups).toHaveLength(1);
    const [only] = merged.groups;
    expect(only?.items.map((one) => one.id)).toEqual(['a', 'b', 'c']);
    expect(only?.count).toBe(3);
    expect(only?.ages).toEqual([3, 3, 9]);
    expect(only?.overdue).toBe(1);
    expect(only?.autoCleanIds).toEqual(['b']);
  });

  it('keeps the server order — of the groups and inside them', () => {
    const merged = mergeQueuePages([
      page([group('ex-1', [item('a')]), group('ex-2', [item('b')])], { nextCursor: 'more' }),
      page([group('ex-3', [item('c')]), group('ex-1', [item('d')])]),
    ]);

    expect(merged.groups.map((one) => one.key)).toEqual(['ex-1', 'ex-2', 'ex-3']);
    expect(merged.groups[0]?.items.map((one) => one.id)).toEqual(['a', 'd']);
  });

  it('takes the whole-scope numbers from the first page and counts overdue over the pages', () => {
    const merged = mergeQueuePages([
      page([group('ex-1', [item('a', { overdue: true })])], { nextCursor: 'more' }),
      page([group('ex-2', [item('b', { overdue: true }), item('c', { overdue: true })])], {
        summary: { pending: 30, overdue: 2, overduePartial: false, oldestHours: 12 },
      }),
    ]);

    expect(merged.summary.pending).toBe(30);
    expect(merged.summary.oldestHours).toBe(50);
    expect(merged.summary.overdue).toBe(3);
  });

  it('drops the "1+" caveat once the last page has been read', () => {
    const first = page([group('ex-1', [item('a')])], { nextCursor: 'more' });

    expect(mergeQueuePages([first]).summary.overduePartial).toBe(true);
    expect(mergeQueuePages([first]).nextCursor).toBe('more');

    const both = mergeQueuePages([first, page([group('ex-2', [item('b')])])]);
    expect(both.summary.overduePartial).toBe(false);
    expect(both.nextCursor).toBeNull();
  });

  it('offers the filter options of the first page — they are the whole scope, not the page', () => {
    const merged = mergeQueuePages([
      page([group('ex-1', [item('a')])], { nextCursor: 'more' }),
      page([group('ex-2', [item('b')])], { facets: { groups: [], courses: [] } }),
    ]);

    expect(merged.facets.groups).toEqual([{ id: 'g1', name: 'B1 mandag' }]);
  });
});
