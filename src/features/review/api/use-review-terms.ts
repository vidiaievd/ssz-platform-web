'use client';

import { useQuery } from '@tanstack/react-query';

import type { ReviewTermsSummary } from '../types';

import { reviewKeys } from './keys';

/**
 * The teacher's week from the auto-acceptance journal — the line under the inbox title
 * (plan 80, step 7e).
 *
 * Slow-moving on purpose: the journal changes when a term runs out, which the engine's job
 * checks every few minutes, and when a verdict's event reaches analytics. Five minutes of
 * staleness is invisible in a figure counted by the week. A failure is `null`, like the
 * route's own answer for an unreadable journal — the inbox simply goes without the line.
 */
export function useReviewTerms(school: string) {
  return useQuery<ReviewTermsSummary | null>({
    queryKey: reviewKeys.terms(school),
    queryFn: async () => {
      const response = await fetch(`/api/review/terms?school=${encodeURIComponent(school)}`);
      if (!response.ok) return null;
      return response.json() as Promise<ReviewTermsSummary | null>;
    },
    enabled: school !== '',
    staleTime: 300_000,
    refetchOnWindowFocus: true,
  });
}
