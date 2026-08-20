import type { ReviewQueueGroup, ReviewQueueResponse } from '../types';

/** What the inbox shows when nothing has been fetched yet. */
const EMPTY: ReviewQueueResponse = {
  summary: { pending: 0, overdue: 0, overduePartial: false, oldestHours: null },
  facets: { groups: [], courses: [] },
  groups: [],
  nextCursor: null,
};

/**
 * Several pages of the queue, read as the one list the teacher is working through.
 *
 * The queue is paged by submission and grouped by the server, so a group routinely
 * straddles a page boundary: page one ends with four of an exercise's submissions and
 * page two opens with the remaining three. Appending the pages' groups as they arrive
 * would put that exercise on screen twice, with two headings and two batch buttons over
 * halves of one pile. So groups are joined by `key`, and everything a heading reports —
 * the count, the histogram, the overdue tally, the ids the batch button resolves to — is
 * joined with them.
 *
 * Order is the server's, top to bottom, in both directions: groups keep the order they
 * first appeared in, and items keep the order they arrived in. Re-sorting here would
 * disagree with the cursor the next page is fetched against, and two teachers looking at
 * the same queue would stop seeing the same first submission.
 *
 * The summary is not summed blindly. `pending` and `oldestHours` are already answers about
 * the whole scope rather than about a page, so the first page's are the true ones; only
 * `overdue` is counted over what has been loaded — lateness needs a promise, and a promise
 * needs the course each submission belongs to (see the BFF route). `overduePartial` follows
 * the last page, so the "1+ longer than promised" caveat drops off by itself once the
 * teacher has read to the end of the queue.
 */
export function mergeQueuePages(pages: ReviewQueueResponse[]): ReviewQueueResponse {
  const [first] = pages;
  if (first === undefined) return EMPTY;

  const last = pages[pages.length - 1] as ReviewQueueResponse;
  const merged = new Map<string, ReviewQueueGroup>();

  for (const page of pages) {
    for (const group of page.groups) {
      const seen = merged.get(group.key);
      if (seen === undefined) {
        merged.set(group.key, { ...group });
        continue;
      }
      merged.set(group.key, {
        ...seen,
        count: seen.count + group.count,
        ages: [...seen.ages, ...group.ages],
        overdue: seen.overdue + group.overdue,
        autoCleanIds: [...seen.autoCleanIds, ...group.autoCleanIds],
        items: [...seen.items, ...group.items],
      });
    }
  }

  return {
    summary: {
      pending: first.summary.pending,
      oldestHours: first.summary.oldestHours,
      overdue: pages.reduce((total, page) => total + page.summary.overdue, 0),
      overduePartial: last.nextCursor !== null,
    },
    facets: first.facets,
    groups: [...merged.values()],
    nextCursor: last.nextCursor,
  };
}
