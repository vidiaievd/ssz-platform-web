'use client';

import { useQueries } from '@tanstack/react-query';

import type { PreflightResult } from '../types';

import { authoringKeys } from './keys';
import { useWorkspaceRef } from '@/features/workspaces/lib/use-workspace-ref';

export interface PreflightEntry {
  result: PreflightResult | undefined;
  isLoading: boolean;
}

/**
 * Pre-flight for several containers at once — the course and each of its
 * modules on the review screen.
 *
 * A hook per row would have to live in a row component, which then has to
 * report "this one is blocked" back up to the screen that owns the selection;
 * doing that during render is exactly the setState-in-render React complains
 * about. Running the queries where the selection lives removes the round trip.
 *
 * Query keys match `useContainerPreflight`, so both share one cache entry.
 */
export function useContainersPreflight(
  containerIds: string[],
  enabled = true,
): Map<string, PreflightEntry> {
  const workspaceId = useWorkspaceRef();

  const results = useQueries({
    queries: containerIds.map((containerId) => ({
      queryKey: [...authoringKeys.preflight(containerId), workspaceId],
      queryFn: async () => {
        const res = await fetch(
          `/api/content/containers/${containerId}/preflight?workspaceId=${encodeURIComponent(workspaceId)}`,
        );
        if (!res.ok) throw new Error('Preflight failed');
        return res.json() as Promise<PreflightResult>;
      },
      enabled: enabled && !!containerId,
      staleTime: 20_000,
    })),
  });

  return new Map(
    containerIds.map((containerId, i) => [
      containerId,
      { result: results[i]?.data, isLoading: results[i]?.isLoading ?? false },
    ]),
  );
}
