import { keyFactory } from '@/lib/query/keys';

import type { ReviewQueueFilters } from '../types';

/**
 * The queue is keyed by its filters because it *is* its filters: switching from "all" to
 * one course is a different list, not a stale version of the same one, and sharing a key
 * would show the old rows under the new heading for as long as the fetch takes.
 *
 * The count is keyed by school alone. It is the sidebar's, it ignores every filter on
 * purpose, and every verdict invalidates it.
 */
export const reviewKeys = keyFactory('review', {
  queue: (school: string, filters: ReviewQueueFilters) => ['queue', school, filters] as const,
  queues: () => ['queue'] as const,
  count: (school: string) => ['count', school] as const,
  counts: () => ['count'] as const,
});
