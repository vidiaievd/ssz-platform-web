'use client';

import { useQuery } from '@tanstack/react-query';

import { queueFiltersToApiQuery } from '../lib/queue-filters';
import type { ReviewQueueCount, ReviewQueueFilters, ReviewQueueResponse } from '../types';

import { reviewKeys } from './keys';

/**
 * Everything waiting on this teacher, under the filters currently in the address bar.
 *
 * Kept deliberately short-lived. Two teachers of the same group work through one queue,
 * and a cached list offers work a colleague finished ten minutes ago — the soft marker on
 * a submission exists precisely because that collision is normal, not exceptional. It also
 * refetches when the window comes back into focus, since the common shape of this screen
 * is a tab left open all morning.
 */
export function useReviewQueue(school: string, filters: ReviewQueueFilters) {
  return useQuery<ReviewQueueResponse>({
    queryKey: reviewKeys.queue(school, filters),
    queryFn: async () => {
      const response = await fetch(`/api/review/queue?${queueFiltersToApiQuery(school, filters)}`);
      if (!response.ok) throw new Error('Failed to fetch the review queue');
      return response.json() as Promise<ReviewQueueResponse>;
    },
    enabled: school !== '',
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    // The previous list stays on screen while a filter change is in flight, so the queue
    // does not blink through an empty state on its way to a different one.
    placeholderData: (previous) => previous,
  });
}

/** The sidebar badge. One count, one flag, asked far more often than the queue itself. */
export function useReviewQueueCount(school: string, enabled = true) {
  return useQuery<ReviewQueueCount>({
    queryKey: reviewKeys.count(school),
    queryFn: async () => {
      const response = await fetch(`/api/review/queue/count?school=${encodeURIComponent(school)}`);
      if (!response.ok) throw new Error('Failed to count the review queue');
      return response.json() as Promise<ReviewQueueCount>;
    },
    enabled: enabled && school !== '',
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
