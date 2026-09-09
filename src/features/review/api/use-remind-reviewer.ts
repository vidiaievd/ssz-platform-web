'use client';

import { useMutation } from '@tanstack/react-query';

import type { ReviewRemindResult } from '../types/oversight';

/**
 * Ask one reviewer to look at what is waiting on them.
 *
 * Nothing on screen changes when this succeeds — no queue moves, no figure updates — so
 * there is nothing to invalidate and nothing to roll back. The whole outcome is the toast,
 * including the ordinary case where the same person was already reminded today: that
 * answers 200 with `sent: false`, because being told "not again until tomorrow" is
 * information, not an error.
 */
export function useRemindReviewer(school: string) {
  return useMutation<ReviewRemindResult, Error, string>({
    mutationFn: async (teacherId: string) => {
      const response = await fetch(`/api/review/remind?school=${encodeURIComponent(school)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId }),
      });
      if (!response.ok) throw new Error('Failed to send the reminder');
      return response.json() as Promise<ReviewRemindResult>;
    },
  });
}
