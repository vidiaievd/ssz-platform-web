'use client';

import { useQuery } from '@tanstack/react-query';

import type { PreflightResult } from '../types';

import { authoringKeys } from './keys';
import { useWorkspaceRef } from '@/features/workspaces/lib/use-workspace-ref';

/**
 * Runs the pre-flight rule engine for any container — a course or one of its
 * modules. The engine itself lives behind content-service's `/internal/*`
 * routes, so this goes through the BFF handler rather than straight to the
 * service.
 */
export function useContainerPreflight(containerId: string, enabled = true) {
  const workspaceId = useWorkspaceRef();
  return useQuery<PreflightResult>({
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
  });
}
