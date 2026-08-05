'use client';

import { useQuery } from '@tanstack/react-query';

import type { SrsCardStatesResponse } from '../types';
import { learningKeys } from './keys';

/**
 * Fetches SRS states for a batch of vocabulary word ids (glossed words in a
 * text lesson, in C3's usage). Ids are sorted before building the query key
 * so that two calls with the same set in a different order share one cache
 * entry instead of fragmenting the cache per ordering.
 */
export function useSrsCardStates(contentIds: string[], enabled = true) {
  const sortedIds = [...contentIds].sort();

  return useQuery<SrsCardStatesResponse>({
    queryKey: learningKeys.srsCardStates('VOCABULARY_WORD', sortedIds),
    queryFn: async () => {
      const res = await fetch('/api/learning/srs/card-states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'VOCABULARY_WORD', contentIds: sortedIds }),
      });
      if (res.status === 401) throw new Error('Unauthenticated');
      if (!res.ok) throw new Error('Failed to fetch SRS card states');
      return res.json() as Promise<SrsCardStatesResponse>;
    },
    staleTime: 60_000,
    enabled: enabled && sortedIds.length > 0,
  });
}
