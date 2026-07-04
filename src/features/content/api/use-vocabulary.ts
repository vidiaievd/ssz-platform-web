'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { VocabularyItem, VocabularyList, PaginatedResponse } from '../types';
import { contentKeys } from './keys';

export type SrsSeedKind = 'DIAGNOSTIC_KNOWN' | 'CLAIMED_KNOWN';

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

/** Introduces a single SRS card. Pass `seedKind` to skip-known seed it (plan 21 §4). */
export function useIntroduceCard() {
  return useMutation({
    mutationFn: async (input: {
      contentType: 'VOCABULARY_WORD' | 'EXERCISE';
      contentId: string;
      seedKind?: SrsSeedKind;
    }) => {
      const res = await fetch('/api/srs/cards/introduce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to introduce card');
      return res.json();
    },
  });
}

/** Introduces every item of a vocabulary list. Pass `seedKind` for the "skip all as known" shortcut. */
export function useBulkIntroduceFromList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { vocabularyListId: string; seedKind?: SrsSeedKind }) => {
      const res = await fetch('/api/srs/cards/bulk-introduce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to bulk-introduce vocabulary list');
      return res.json() as Promise<{ introduced: number; skipped: number }>;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: contentKeys.vocabularyItems(variables.vocabularyListId),
      });
    },
  });
}
