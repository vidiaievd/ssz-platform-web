'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContainerItem } from '../types';
import { contentKeys } from './keys';

export function useContainerItems(containerId: string, versionId: string, enabled = true) {
  return useQuery<ContainerItem[]>({
    queryKey: contentKeys.containerItems(containerId, versionId),
    queryFn: async () => {
      const res = await fetch(
        `/api/content/containers/${containerId}/items?versionId=${versionId}`,
      );
      if (!res.ok) throw new Error('Failed to fetch container items');
      return res.json() as Promise<ContainerItem[]>;
    },
    staleTime: 120_000,
    enabled: enabled && !!containerId && !!versionId,
  });
}
