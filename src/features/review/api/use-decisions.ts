'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import type { OversightPeriod, ReviewDecisionsResponse } from '../types/oversight';

import { reviewKeys } from './keys';

/**
 * The decision journal, a page at a time.
 *
 * Infinite rather than paged: the journal is read downwards from the most recent verdict —
 * "what happened this week" — and page numbers over a list that grows from the top would
 * shift under the reader as new verdicts land. The export takes the whole period in one
 * file, so nobody has to scroll to the end here to get at the rest.
 */
export function useDecisions(school: string, period: OversightPeriod) {
  return useInfiniteQuery<ReviewDecisionsResponse>({
    queryKey: reviewKeys.decisions(school, period),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const query = new URLSearchParams({ school, period: String(period) });
      if (typeof pageParam === 'string') query.set('cursor', pageParam);

      const response = await fetch(`/api/review/decisions?${query.toString()}`);
      if (!response.ok) throw new Error('Failed to read the journal');
      return response.json() as Promise<ReviewDecisionsResponse>;
    },
    getNextPageParam: (last) => last.nextCursor,
    enabled: school !== '',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
