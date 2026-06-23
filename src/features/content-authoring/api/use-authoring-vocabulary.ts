'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContainerItem, VocabularyList, VocabularyItem } from '@/features/content/types';

import { authoringKeys } from './keys';

// A course has at most one vocabulary list in this UI — found via the
// container's draft items (vocabulary lists are standalone content, not
// filterable by containerId on the backend).
export function useAuthoringVocabularyLists(containerId: string, enabled = true) {
  return useQuery<VocabularyList[]>({
    queryKey: authoringKeys.vocabularyLists(containerId),
    queryFn: async () => {
      const itemsRes = await fetch(`/api/content/containers/${containerId}/items?draft=true`);
      if (!itemsRes.ok) throw new Error('Failed to fetch vocabulary lists');
      const items: ContainerItem[] = await itemsRes.json();
      const listItem = items.find((i) => i.itemType === 'vocabulary_list');
      if (!listItem) return [];

      const res = await fetch(`/api/content/vocabulary-lists/${listItem.itemId}`);
      if (!res.ok) throw new Error('Failed to fetch vocabulary list');
      return [(await res.json()) as VocabularyList];
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
      const data: { items: VocabularyItem[] } = await res.json();
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
