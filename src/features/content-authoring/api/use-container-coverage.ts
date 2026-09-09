'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContainerCoverage, CoverageVersionScope } from '../types';

import { authoringKeys } from './keys';

/**
 * What a course or module trains — the three tallies, the remarks, and whether
 * the draft and the published version disagree.
 *
 * Asked for as `both` by default, because the one sentence the strip must be
 * able to say — "the version your students have trains something else" — cannot
 * be assembled from the draft alone, and asking twice would mean walking the
 * tree twice.
 *
 * Nothing is cached server-side: the report is a walk over the container's
 * exercises, recomputed per request. Held for a minute here so that clicking
 * between modules in the tree does not re-walk the same course.
 */
export function useContainerCoverage(
  containerId: string,
  version: CoverageVersionScope = 'both',
  enabled = true,
) {
  return useQuery<ContainerCoverage>({
    queryKey: authoringKeys.coverage(containerId, version),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/${containerId}/coverage?version=${version}`);
      if (!res.ok) throw new Error('Failed to fetch coverage');
      return res.json() as Promise<ContainerCoverage>;
    },
    enabled: enabled && !!containerId,
    staleTime: 60_000,
  });
}
