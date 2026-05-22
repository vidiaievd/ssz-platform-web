'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContentTag } from '@/features/content/types';

import { authoringKeys } from './keys';

export function useEntityTags(entityType: string, entityId: string, enabled = true) {
  return useQuery<ContentTag[]>({
    queryKey: authoringKeys.tags(entityType, entityId),
    queryFn: async () => {
      const params = new URLSearchParams({ entityType, entityId });
      const res = await fetch(`/api/content/tags?${params}`);
      if (!res.ok) return [];
      return res.json() as Promise<ContentTag[]>;
    },
    enabled: enabled && !!entityType && !!entityId,
    staleTime: 30_000,
  });
}

export function useTagSuggestions(entityType: string, query: string, enabled = true) {
  return useQuery<string[]>({
    queryKey: ['tag-suggestions', entityType, query],
    queryFn: async () => {
      const params = new URLSearchParams({ entityType });
      if (query) params.set('q', query);
      const res = await fetch(`/api/content/tags/suggestions?${params}`);
      if (!res.ok) return [];
      return res.json() as Promise<string[]>;
    },
    enabled: enabled && !!entityType,
    staleTime: 30_000,
  });
}
