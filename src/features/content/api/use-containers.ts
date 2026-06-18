'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import type { Container, PaginatedResponse } from '../types';
import type { ContainerFilters } from '../schemas';
import { contentKeys } from './keys';

export type ContainerScope = 'public' | 'enrolled' | 'all';

export interface UseContainersOptions {
  filters?: Omit<ContainerFilters, 'cursor'>;
  scope?: ContainerScope;
  enabled?: boolean;
}

export function useContainers({ filters, scope = 'public', enabled = true }: UseContainersOptions = {}) {
  return useInfiniteQuery<PaginatedResponse<Container>>({
    queryKey: [...contentKeys.containers(filters), scope],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.targetLanguage) params.set('targetLanguage', filters.targetLanguage);
      if (filters?.level) params.set('level', filters.level);
      if (filters?.type) params.set('type', filters.type);
      if (scope) params.set('scope', scope);
      if (pageParam) params.set('cursor', pageParam as string);

      const res = await fetch(`/api/content/containers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch containers');
      return res.json() as Promise<PaginatedResponse<Container>>;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.nextCursor : undefined,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
