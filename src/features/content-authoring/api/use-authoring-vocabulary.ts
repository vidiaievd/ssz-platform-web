'use client';

import { useQuery } from '@tanstack/react-query';

import type { VocabularyList, VocabularyItem, PaginatedResponse } from '@/features/content/types';

import { authoringKeys } from './keys';

export function useAuthoringVocabularyLists(containerId: string, enabled = true) {
  return useQuery<VocabularyList[]>({
    queryKey: authoringKeys.vocabularyLists(containerId),
    queryFn: async () => {
      const res = await fetch(
        `/api/content/vocabulary-lists?containerId=${containerId}&limit=10`,
      );
      if (!res.ok) throw new Error('Failed to fetch vocabulary lists');
      const data: PaginatedResponse<VocabularyList> = await res.json();
      return data.items;
    },
    enabled: enabled && !!containerId,
    staleTime: 30_000,
  });
}

export function useAuthoringVocabularyItems(listId: string, enabled = true) {
  return useQuery<VocabularyItem[]>({
    queryKey: authoringKeys.vocabularyItems(listId),
    queryFn: async () => {
      const res = await fetch(
        `/api/content/vocabulary-lists/${listId}/items?limit=500`,
      );
      if (!res.ok) throw new Error('Failed to fetch vocabulary items');
      const data: PaginatedResponse<VocabularyItem> = await res.json();
      return data.items;
    },
    enabled: enabled && !!listId,
    staleTime: 30_000,
  });
}

export function useAuthoringVocabularyItem(
  listId: string,
  itemId: string | null,
  enabled = true,
) {
  return useQuery<VocabularyItem>({
    queryKey: authoringKeys.vocabularyItem(listId, itemId ?? ''),
    queryFn: async () => {
      const res = await fetch(
        `/api/content/vocabulary-lists/${listId}/items/${itemId}`,
      );
      if (!res.ok) throw new Error('Failed to fetch vocabulary item');
      return res.json() as Promise<VocabularyItem>;
    },
    enabled: enabled && !!listId && !!itemId,
    staleTime: 60_000,
  });
}
