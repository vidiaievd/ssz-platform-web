'use client';

import { useQuery } from '@tanstack/react-query';

import type { SrsDueResponse } from '../types';
import { learningKeys } from './keys';

export function useSrsDue(options?: { enabled?: boolean }) {
  return useQuery<SrsDueResponse>({
    queryKey: learningKeys.srsDue(),
    queryFn: async () => {
      const res = await fetch('/api/learning/srs/due');
      if (res.status === 401) throw new Error('Unauthenticated');
      if (!res.ok) throw new Error('Failed to fetch SRS queue');
      return res.json() as Promise<SrsDueResponse>;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled: options?.enabled ?? true,
  });
}
