'use client';

import { useQuery } from '@tanstack/react-query';

import type { CourseResult } from '../types';

import { authoringKeys } from './keys';

/**
 * What happened when people took this course — the result half of screen E.
 *
 * Asked separately from the coverage report rather than merged server-side: the two
 * halves come from two services, they fail independently, and a screen that can say
 * "this is what the course trains, and we could not reach the results" is more useful
 * than one that shows nothing when analytics is down.
 *
 * Held for a minute, like coverage beside it: profiles move on attempts, not on edits,
 * and an author clicking around their own course should not re-aggregate every learner.
 */
export function useCourseResult(containerId: string, enabled = true) {
  return useQuery<CourseResult>({
    queryKey: authoringKeys.courseResult(containerId),
    queryFn: async () => {
      const res = await fetch(`/api/analytics/containers/${containerId}/result`);
      if (!res.ok) throw new Error('Failed to fetch course result');
      return res.json() as Promise<CourseResult>;
    },
    enabled: enabled && !!containerId,
    staleTime: 60_000,
  });
}
