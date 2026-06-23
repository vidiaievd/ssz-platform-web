'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContainerSection } from '@/features/content/types';

import { authoringKeys } from './keys';

export function useAuthoringSections(containerId: string, enabled = true) {
  return useQuery<ContainerSection[]>({
    queryKey: authoringKeys.sections(containerId),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/${containerId}/sections?draft=true`);
      if (!res.ok) throw new Error('Failed to fetch sections');
      return res.json() as Promise<ContainerSection[]>;
    },
    enabled: enabled && !!containerId,
    staleTime: 30_000,
  });
}
