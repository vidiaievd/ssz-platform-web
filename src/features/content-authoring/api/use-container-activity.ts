'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContainerActivity } from '../types';

import { authoringKeys } from './keys';

/**
 * Who changed this course and the material it places, newest first.
 *
 * One page only. Paging exists in the API (`before`), but the panel that reads
 * this shows a recent-history summary — the day someone needs the whole record
 * is the day this becomes `useInfiniteQuery`, and guessing at that now would
 * ship a cursor nothing turns.
 */
export function useContainerActivity(containerId: string, enabled = true) {
  return useQuery<ContainerActivity>({
    queryKey: authoringKeys.activity(containerId),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/${containerId}/activity?limit=20`);
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json() as Promise<ContainerActivity>;
    },
    enabled: enabled && !!containerId,
    // Shorter than the rest of authoring: this is the panel an author opens
    // right after saving, to check that what they just did was recorded.
    staleTime: 10_000,
  });
}
