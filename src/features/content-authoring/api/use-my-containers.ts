'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContainerListQuery, ContainerListResponse } from '../types';
import { authoringKeys } from './keys';

// Maps the UI's friendly sort options to the backend's `field_direction` tokens.
// Only created_at, updated_at, and title are sortable server-side.
const SORT_MAP: Record<NonNullable<ContainerListQuery['sort']>, string> = {
  recently_edited: 'updated_at_desc',
  name_asc: 'title_asc',
};

export function useMyContainers(query?: ContainerListQuery) {
  return useQuery<ContainerListResponse>({
    queryKey: authoringKeys.containers(query),
    queryFn: async () => {
      // "My containers" — scoped to the current user server-side by the BFF.
      const params = new URLSearchParams({ scope: 'owned' });

      if (query?.search)   params.set('search', query.search);
      if (query?.language) params.set('targetLanguage', query.language);
      if (query?.level)    params.set('difficultyLevel', query.level);
      params.set('sort', SORT_MAP[query?.sort ?? 'recently_edited']);
      if (query?.page)     params.set('page', String(query.page));
      params.set('limit', String(query?.pageSize ?? 25));

      const res = await fetch(`/api/content/containers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch containers');

      const raw = (await res.json()) as {
        items: ContainerListResponse['items'];
        total?: number;
      };

      let items = raw.items ?? [];
      // Container state (draft/published) has no server-side filter yet — filter client-side.
      if (query?.state && query.state !== 'all') {
        items = items.filter((c) =>
          query.state === 'published' ? !!c.currentPublishedVersionId : !c.currentPublishedVersionId,
        );
      }

      const total = raw.total ?? items.length;
      const pageNum = query?.page ?? 1;
      const pageSize = query?.pageSize ?? 25;

      // Computed from the current page only (works for moderate lists; backend should provide this later).
      const counts = {
        all: total,
        draft:     items.filter((c) => !c.currentPublishedVersionId).length,
        published: items.filter((c) =>  c.currentPublishedVersionId).length,
        archived:  0, // no backend support yet
      };

      return { items, total, page: pageNum, pageSize, counts };
    },
    staleTime: 30_000,
  });
}
