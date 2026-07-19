'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ProgressRecord, UpsertProgressRequest } from '../types';
import { learningKeys } from './keys';

/**
 * Upserts progress for one content item (BE3.3) — the footer "Next" action
 * marks the current item done, which flows into the unit-contents and
 * course-home progress read models. Invalidates both so the sidebar's
 * percent/status and the next item's lock state update immediately.
 */
export function useUpsertProgress(courseId: string, unitId: string) {
  const queryClient = useQueryClient();

  return useMutation<ProgressRecord, Error, UpsertProgressRequest>({
    mutationFn: async (body) => {
      const res = await fetch('/api/learning/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) throw new Error('unauthenticated');
      if (!res.ok) throw new Error('Failed to save progress');
      return res.json() as Promise<ProgressRecord>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: learningKeys.unitContents(unitId) });
      void queryClient.invalidateQueries({ queryKey: learningKeys.courseHome(courseId) });
    },
  });
}
