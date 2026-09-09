'use client';

import { useQuery } from '@tanstack/react-query';

import type { OversightPeriod, ReviewOversightResponse } from '../types/oversight';

import { reviewKeys } from './keys';

/**
 * The whole oversight screen, in one query.
 *
 * Long-lived on the client, unlike the teacher's queue. Nobody marks from this screen, so
 * a figure a minute old costs nothing — and the answer behind it is four services deep,
 * which is why the BFF caches it for a minute too. Refetching on focus is off for the same
 * reason: an administrator leaves this tab open and comes back to it, and a screen that
 * silently rebuilt itself would move the rows they were reading.
 */
export function useOversight(school: string, period: OversightPeriod) {
  return useQuery<ReviewOversightResponse>({
    queryKey: reviewKeys.oversight(school, period),
    queryFn: async () => {
      const response = await fetch(
        `/api/review/oversight?school=${encodeURIComponent(school)}&period=${period}`,
      );
      if (!response.ok) throw new Error('Failed to read the review load');
      return response.json() as Promise<ReviewOversightResponse>;
    },
    enabled: school !== '',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    // Switching the period keeps the previous picture up while the new one arrives: the
    // sections are tall, and blanking them would drop the page's scroll position.
    placeholderData: (previous) => previous,
  });
}
