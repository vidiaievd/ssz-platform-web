'use client';

import { useQuery } from '@tanstack/react-query';

import type { MySubmissionsFilter, MySubmissionsResponse } from '../types';

import { mySubmissionsKeys } from './keys';

/**
 * What this learner handed in and what came back.
 *
 * Refetched when the window comes back, and kept fresh briefly: the whole reason someone
 * opens this screen is that they are wondering whether an answer has arrived, and a cached
 * "still waiting" is the one answer it must not invent. The previous list stays on screen
 * while a tab change is in flight, so switching filters does not blink through an empty
 * state on the way to a full one.
 */
export function useMySubmissions(status: MySubmissionsFilter) {
  return useQuery<MySubmissionsResponse>({
    queryKey: mySubmissionsKeys.list(status),
    queryFn: async () => {
      const response = await fetch(`/api/student/submissions?status=${status}`);
      if (!response.ok) throw new Error('Failed to load your submissions');
      return response.json() as Promise<MySubmissionsResponse>;
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    placeholderData: (previous) => previous,
  });
}
