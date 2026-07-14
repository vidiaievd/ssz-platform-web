'use client';

import { useQuery } from '@tanstack/react-query';

import type { CurriculumTree } from '@/features/content/types';

import { authoringKeys } from './keys';

export function useCurriculumTree(containerId: string, versionId: string | null | undefined) {
  return useQuery<CurriculumTree>({
    queryKey: authoringKeys.tree(containerId, versionId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/${containerId}/versions/${versionId}/tree`);
      if (!res.ok) throw new Error('Failed to fetch curriculum tree');
      return res.json() as Promise<CurriculumTree>;
    },
    enabled: !!containerId && !!versionId,
    staleTime: 15_000,
  });
}
