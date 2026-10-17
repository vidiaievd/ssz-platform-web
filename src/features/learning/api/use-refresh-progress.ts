'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { learningKeys } from './keys';

/**
 * How long the engine's attempt event takes to reach progress, give or take. The check
 * answers before learning has heard of it, so a refetch fired at once reads the state
 * from before the attempt.
 */
export const PROGRESS_SETTLE_MS = 1500;

/**
 * Re-reads the unit's and the course's progress after an exercise was checked (plan 76,
 * 2.6). The reader no longer writes an exercise's progress itself — whether it passed, or
 * went to a teacher, is the engine's to say, and it says it through its event — so all
 * the reader can do is look again once that event has had time to land.
 */
export function useRefreshProgress(courseId: string, unitId: string) {
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void queryClient.invalidateQueries({ queryKey: learningKeys.unitContents(unitId) });
      void queryClient.invalidateQueries({ queryKey: learningKeys.courseHome(courseId) });
    }, PROGRESS_SETTLE_MS);
  }, [queryClient, courseId, unitId]);
}
