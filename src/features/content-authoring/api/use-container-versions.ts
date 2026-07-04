'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContainerVersion } from '@/features/content/types';

import { authoringKeys } from './keys';

export function useContainerVersions(containerId: string, enabled = true) {
  return useQuery<ContainerVersion[]>({
    queryKey: authoringKeys.versions(containerId),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/${containerId}/versions`);
      if (!res.ok) throw new Error('Failed to fetch versions');
      return res.json() as Promise<ContainerVersion[]>;
    },
    enabled: enabled && !!containerId,
    staleTime: 15_000,
  });
}
