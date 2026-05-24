'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContainerListQuery, ContainerListResponse } from '../types';
import { authoringKeys } from './keys';

export function useMyContainers(query?: ContainerListQuery) {
  return useQuery<ContainerListResponse>({
    queryKey: authoringKeys.containers(query),
    queryFn: async () => {
      const params = new URLSearchParams({ scope: 'owned' });

      if (query?.search)   params.set('search', query.search);
      if (query?.state && query.state !== 'all') {
        if (query.state === 'draft')     params.set('isPublished', 'false');
        if (query.state === 'published') params.set('isPublished', 'true');
        // archived: no backend support yet — filter client-side after fetch
      }
      if (query?.language)             params.set('targetLanguage', query.language);
      if (query?.level)                params.set('level', query.level);
      if (query?.sort)                 params.set('sort', query.sort);
      if (query?.page)                 params.set('page', String(query.page));
      if (query?.pageSize)             params.set('pageSize', String(query.pageSize));

      const res = await fetch(`/api/content/containers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch containers');

      // The BFF currently returns PaginatedResponse<Container> (cursor-based).
      // We adapt it here to the ContainerListResponse shape.
      const raw = (await res.json()) as {
        items: ContainerListResponse['items'];
        pageInfo?: { total?: number; hasNextPage?: boolean };
        total?: number;
      };

      const items = raw.items ?? [];
      const total = raw.total ?? raw.pageInfo?.total ?? items.length;
      const pageNum = query?.page ?? 1;
      const pageSize = query?.pageSize ?? 25;

      // Compute counts from items (works for moderate lists; backend should provide this later).
      const counts = {
        all: total,
        draft:     items.filter((c) => !c.isPublished).length,
        published: items.filter((c) =>  c.isPublished).length,
        archived:  0, // no backend support yet
      };

      return { items, total, page: pageNum, pageSize, counts };
    },
    staleTime: 30_000,
  });
}
