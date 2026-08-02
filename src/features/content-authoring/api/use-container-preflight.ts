'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import type { PreflightResult } from '../types';

import { authoringKeys } from './keys';

/**
 * Runs the pre-flight rule engine for any container — a course or one of its
 * modules. The engine itself lives behind content-service's `/internal/*`
 * routes, so this goes through the BFF handler rather than straight to the
 * service.
 */
export function useContainerPreflight(containerId: string, enabled = true) {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  return useQuery<PreflightResult>({
    queryKey: [...authoringKeys.preflight(containerId), schoolSlug],
    queryFn: async () => {
      const res = await fetch(
        `/api/content/containers/${containerId}/preflight?schoolSlug=${encodeURIComponent(schoolSlug)}`,
      );
      if (!res.ok) throw new Error('Preflight failed');
      return res.json() as Promise<PreflightResult>;
    },
    enabled: enabled && !!containerId,
    staleTime: 20_000,
  });
}
