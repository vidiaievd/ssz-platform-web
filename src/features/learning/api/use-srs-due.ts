'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';

import type { SrsDueResponse } from '../types';
import { learningKeys } from './keys';

export function useSrsDue(options?: { enabled?: boolean }) {
  // The server resolves each card's translation into this language.
  const locale = useLocale();

  return useQuery<SrsDueResponse>({
    queryKey: [...learningKeys.srsDue(), locale],
    queryFn: async () => {
      const res = await fetch(`/api/learning/srs/due?language=${encodeURIComponent(locale)}`);
      if (res.status === 401) throw new Error('Unauthenticated');
      if (!res.ok) throw new Error('Failed to fetch SRS queue');
      return res.json() as Promise<SrsDueResponse>;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled: options?.enabled ?? true,
  });
}
