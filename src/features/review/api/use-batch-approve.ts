'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ReviewBatchResult, ReviewQueueCount } from '../types';

import { reviewKeys } from './keys';

/**
 * Approve a named list of machine-closed submissions in one call.
 *
 * The ids are sent, never a filter: the dialog listed those learners and it is that list
 * which is carried out. The count in the sidebar drops by what was actually approved
 * rather than by what was asked for, since a colleague may have answered one of them in
 * the seconds the dialog was open — and the invalidation behind it corrects both.
 */
export function useBatchApprove(school: string) {
  const queryClient = useQueryClient();

  return useMutation<ReviewBatchResult, Error, string[]>({
    mutationFn: async (attemptIds) => {
      const response = await fetch(
        `/api/review/batch-approve?school=${encodeURIComponent(school)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attemptIds }),
        },
      );
      if (!response.ok) throw new Error(String(response.status));
      return (await response.json()) as ReviewBatchResult;
    },

    onSuccess: (result) => {
      queryClient.setQueryData<ReviewQueueCount>(reviewKeys.count(school), (current) =>
        current === undefined
          ? current
          : { ...current, pending: Math.max(current.pending - result.approved, 0) },
      );
      void queryClient.invalidateQueries({ queryKey: reviewKeys.queues() });
      void queryClient.invalidateQueries({ queryKey: reviewKeys.counts() });
    },
  });
}
