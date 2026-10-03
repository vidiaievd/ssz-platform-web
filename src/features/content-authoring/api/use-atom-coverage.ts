'use client';

import { useQuery } from '@tanstack/react-query';

import type { AtomCoverage, AtomCoverageVersionScope } from '../types';

import { authoringKeys } from './keys';

/**
 * The facts a container teaches, against the items that test them — plan 63 §4.2.
 *
 * The draft by default, for the reason the skill coverage hook asks for it: the draft is
 * what the author is editing, and a report about the published version would be a report
 * about work they have already moved on from.
 *
 * Not cached server-side — it is a walk over the container — and held for a minute here,
 * so that clicking around the tree does not re-walk the same course.
 */
export function useAtomCoverage(
  containerId: string,
  version: AtomCoverageVersionScope = 'draft',
  enabled = true,
) {
  return useQuery<AtomCoverage>({
    queryKey: authoringKeys.atomCoverage(containerId, version),
    queryFn: async () => {
      const res = await fetch(
        `/api/content/containers/${containerId}/atom-coverage?version=${version}`,
      );
      if (!res.ok) throw new Error('Failed to fetch atom coverage');
      return res.json() as Promise<AtomCoverage>;
    },
    enabled: enabled && !!containerId,
    staleTime: 60_000,
  });
}
