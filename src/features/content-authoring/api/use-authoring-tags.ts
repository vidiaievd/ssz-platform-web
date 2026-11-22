'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContentTag, TagSuggestion } from '@/features/content/types';

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

/** Global tags plus, for a school's material, the school's own. */
export function useTagSuggestions(ownerSchoolId: string | null, query: string, enabled = true) {
  return useQuery<TagSuggestion[]>({
    queryKey: ['tag-suggestions', ownerSchoolId, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (ownerSchoolId) params.set('schoolId', ownerSchoolId);
      if (query) params.set('q', query);
      const res = await fetch(`/api/content/tags/suggestions?${params}`);
      if (!res.ok) return [];
      return res.json() as Promise<TagSuggestion[]>;
    },
    enabled,
    staleTime: 30_000,
  });
}
