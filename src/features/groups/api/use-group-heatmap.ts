'use client';

import { useQuery } from '@tanstack/react-query';

import type { GroupHeatmap } from '@/features/analytics/types';

/**
 * Screen B's rows — fetched only once the panel is on screen.
 *
 * Separate from the chart's query on purpose: this one carries a row per learner and is
 * refused outright to roles that may not see named results, so a failure here must not
 * take the chart above it down with it.
 */
export function useGroupHeatmap(schoolId: string, groupId: string, enabled = true) {
  return useQuery<GroupHeatmap>({
    queryKey: ['groups', schoolId, groupId, 'heatmap'],
    enabled,
    queryFn: async () => {
      const res = await fetch(`/api/schools/${schoolId}/groups/${groupId}/heatmap`);
      if (!res.ok) throw new Error('Failed to fetch group heatmap');
      return (await res.json()) as GroupHeatmap;
    },
    staleTime: 60_000,
  });
}
