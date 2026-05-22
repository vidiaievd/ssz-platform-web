'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import type { Container, PaginatedResponse } from '@/features/content/types';

import type { AuthoringFilters } from '../types';
import { authoringKeys } from './keys';

export function useMyContainers(filters?: AuthoringFilters) {
  return useInfiniteQuery<PaginatedResponse<Container>>({
    queryKey: authoringKeys.containers(filters),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ scope: 'owned' });
      if (filters?.status === 'draft') params.set('isPublished', 'false');
      if (filters?.status === 'published') params.set('isPublished', 'true');
      if (pageParam) params.set('cursor', pageParam as string);

      const res = await fetch(`/api/content/containers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch containers');
      return res.json() as Promise<PaginatedResponse<Container>>;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.nextCursor : undefined,
    staleTime: 30_000,
  });
}
