'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContainerShare } from '@/features/content/types';

import { authoringKeys } from './keys';

export function useEntityShares(entityType: string, entityId: string, enabled = true) {
  return useQuery<ContainerShare[]>({
    queryKey: authoringKeys.shares(entityType, entityId),
    queryFn: async () => {
      const params = new URLSearchParams({ entityType, entityId });
      const res = await fetch(`/api/content/shares?${params}`);
      if (!res.ok) return [];
      return res.json() as Promise<ContainerShare[]>;
    },
    enabled: enabled && !!entityType && !!entityId,
    staleTime: 30_000,
  });
}
