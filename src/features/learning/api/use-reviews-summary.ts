'use client';

import { useQuery } from '@tanstack/react-query';

import type { ReviewsSummary } from '../types';
import { learningKeys } from './keys';

export function useReviewsSummary(options?: { enabled?: boolean }) {
  return useQuery<ReviewsSummary>({
    queryKey: learningKeys.reviewsSummary(),
    queryFn: async () => {
      const res = await fetch('/api/learning/reviews/summary');
      if (!res.ok) throw new Error('Failed to load review summary');
      return res.json() as Promise<ReviewsSummary>;
    },
    // The backlog shrinks with every rating, so a stale count is a wrong count.
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled: options?.enabled ?? true,
  });
}
