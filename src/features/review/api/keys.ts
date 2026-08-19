import { keyFactory } from '@/lib/query/keys';

import type { ReviewQueueFilters } from '../types';
import type { OversightPeriod } from '../types/oversight';

/**
 * The queue is keyed by its filters because it *is* its filters: switching from "all" to
 * one course is a different list, not a stale version of the same one, and sharing a key
 * would show the old rows under the new heading for as long as the fetch takes.
 *
 * The count is keyed by school alone. It is the sidebar's, it ignores every filter on
 * purpose, and every verdict invalidates it.
 *
 * Oversight is keyed by its period for the same reason as the queue by its filters: seven
 * days and ninety are two different answers to "how fast do we reply", not two versions of
 * one. Its own answer is cached for a minute in the BFF, so switching back and forth costs
 * nothing upstream.
 */
export const reviewKeys = keyFactory('review', {
  queue: (school: string, filters: ReviewQueueFilters) => ['queue', school, filters] as const,
  queues: () => ['queue'] as const,
  count: (school: string) => ['count', school] as const,
  counts: () => ['count'] as const,
  submission: (school: string, id: string) => ['submission', school, id] as const,
  submissions: () => ['submission'] as const,
  oversight: (school: string, period: OversightPeriod) => ['oversight', school, period] as const,
  oversights: () => ['oversight'] as const,
  decisions: (school: string, period: OversightPeriod) => ['decisions', school, period] as const,
  decisionLog: () => ['decisions'] as const,
});
