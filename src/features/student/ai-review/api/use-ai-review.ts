'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AiReview, DisputeAiReviewRequest, DisputeAiReviewResponse } from '../types';

import { aiReviewKeys } from './keys';

/**
 * A model's review of one of the learner's attempts (plan 79, step 2.3).
 *
 * `null`, not an error, when there is none (`NO_AI_REVIEW`): a caller that asked on a hunch
 * gets nothing to draw. A review does not change once written — only `disputedAt` moves, and
 * that by this learner's own press — so it is not refetched on focus.
 */
export function useAiReview(exerciseId: string, attemptId: string, enabled = true) {
  return useQuery<AiReview | null>({
    queryKey: aiReviewKeys.detail(exerciseId, attemptId),
    queryFn: async () => {
      const res = await fetch(`/api/exercises/${exerciseId}/attempts/${attemptId}/ai-review`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to load the review');
      return res.json() as Promise<AiReview>;
    },
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/**
 * "This review is wrong". Once per review — the engine answers a repeat with the first
 * press — so the cached review takes the answer's time and the button goes away for good.
 */
export function useDisputeAiReview(exerciseId: string, attemptId: string) {
  const queryClient = useQueryClient();
  return useMutation<DisputeAiReviewResponse, Error, DisputeAiReviewRequest>({
    mutationFn: async (body) => {
      const res = await fetch(
        `/api/exercises/${exerciseId}/attempts/${attemptId}/ai-review/dispute`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error('Failed to send the dispute');
      return res.json() as Promise<DisputeAiReviewResponse>;
    },
    onSuccess: ({ disputedAt }) => {
      queryClient.setQueryData<AiReview | null>(
        aiReviewKeys.detail(exerciseId, attemptId),
        (review) => (review == null ? review : { ...review, disputedAt }),
      );
    },
  });
}
