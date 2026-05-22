'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import type { VocabularyItem, VocabularyList, PaginatedResponse } from '../types';
import { contentKeys } from './keys';

export function useVocabularyList(listId: string, enabled = true) {
  return useQuery<VocabularyList>({
    queryKey: contentKeys.vocabularyList(listId),
    queryFn: async () => {
      const res = await fetch(`/api/content/vocabulary-lists/${listId}`);
      if (!res.ok) throw new Error('Failed to fetch vocabulary list');
      return res.json() as Promise<VocabularyList>;
    },
    staleTime: 120_000,
    enabled: enabled && !!listId,
  });
}

export function useVocabularyItems(listId: string, enabled = true) {
  return useInfiniteQuery<PaginatedResponse<VocabularyItem>>({
    queryKey: contentKeys.vocabularyItems(listId),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set('cursor', pageParam as string);
      const res = await fetch(
        `/api/content/vocabulary-lists/${listId}/items?${params.toString()}`,
      );
      if (!res.ok) throw new Error('Failed to fetch vocabulary items');
      return res.json() as Promise<PaginatedResponse<VocabularyItem>>;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.nextCursor : undefined,
    staleTime: 120_000,
    enabled: enabled && !!listId,
  });
}
