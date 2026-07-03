'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ReviewRequest, ReviewResponse } from '../types';
import { learningKeys } from './keys';

export function useSrsReview(cardId: string) {
  const queryClient = useQueryClient();

  return useMutation<ReviewResponse, Error, ReviewRequest>({
    mutationFn: async (body) => {
      const res = await fetch(`/api/learning/srs/cards/${cardId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 429) throw new Error('rate_limited');
      if (res.status === 401) throw new Error('unauthenticated');
      if (!res.ok) throw new Error('Failed to submit review');
      return res.json() as Promise<ReviewResponse>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: learningKeys.srsDue() });
    },
  });
}
