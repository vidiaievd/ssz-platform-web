'use client';

import { useQuery } from '@tanstack/react-query';

import type { SrsStats } from '../types';
import { learningKeys } from './keys';

export function useSrsStats() {
  return useQuery<SrsStats>({
    queryKey: learningKeys.srsStats(),
    queryFn: async () => {
      const res = await fetch('/api/learning/srs/stats');
      if (res.status === 401) throw new Error('Unauthenticated');
      if (!res.ok) throw new Error('Failed to fetch SRS stats');
      return res.json() as Promise<SrsStats>;
    },
    staleTime: 5 * 60_000,
  });
}
