'use client';

import { useQuery } from '@tanstack/react-query';

import type { UnitContentsResult } from '../types';
import { learningKeys } from './keys';

export function useUnitContents(moduleId: string) {
  return useQuery<UnitContentsResult>({
    queryKey: learningKeys.unitContents(moduleId),
    queryFn: async () => {
      const res = await fetch(`/api/learning/units/${encodeURIComponent(moduleId)}/contents`);
      if (res.status === 401) throw new Error('Unauthenticated');
      if (res.status === 404) throw new Error('Unit not found');
      if (!res.ok) throw new Error('Failed to load unit contents');
      return res.json() as Promise<UnitContentsResult>;
    },
    staleTime: 60_000,
    enabled: !!moduleId,
  });
}
