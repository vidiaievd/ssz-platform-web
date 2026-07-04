'use client';

import { useQuery } from '@tanstack/react-query';

import type { UnitPayload } from '../types';
import { learningKeys } from './keys';

export function useUnitPayload(moduleId: string) {
  return useQuery<UnitPayload>({
    queryKey: learningKeys.unitPayload(moduleId),
    queryFn: async () => {
      const res = await fetch(`/api/learning/unit/${encodeURIComponent(moduleId)}`);
      if (res.status === 401) throw new Error('Unauthenticated');
      if (res.status === 404) throw new Error('Unit not found');
      if (!res.ok) throw new Error('Failed to load unit');
      return res.json() as Promise<UnitPayload>;
    },
    staleTime: 5 * 60_000,
    enabled: !!moduleId,
  });
}
