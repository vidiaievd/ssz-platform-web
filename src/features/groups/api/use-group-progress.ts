'use client';

import { useQuery } from '@tanstack/react-query';

import type { GroupProgress } from '@/features/analytics/types';

/**
 * Screen A's data, through the BFF route that checks whether this teacher may see this
 * group (plan 58 §2 F).
 *
 * Deliberately not prefetched on the server with the rest of the group page: the tab is
 * one of six and the projection behind it can be a second behind the journal, so a slow
 * or unavailable analytics service empties one tab instead of delaying every tab.
 */
export function useGroupProgress(schoolId: string, groupId: string, enabled = true) {
  return useQuery<GroupProgress>({
    queryKey: ['groups', schoolId, groupId, 'progress'],
    enabled,
    queryFn: async () => {
      const res = await fetch(`/api/schools/${schoolId}/groups/${groupId}/progress`);
      if (!res.ok) throw new Error('Failed to fetch group progress');
      return (await res.json()) as GroupProgress;
    },
    staleTime: 60_000,
  });
}
