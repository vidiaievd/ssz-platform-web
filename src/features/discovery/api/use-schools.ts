'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import type { SchoolFilters } from '../schemas';
import type { SchoolsResponse } from '../types';
import { discoveryKeys } from './keys';

export interface UseSchoolsOptions {
  filters?: SchoolFilters;
  enabled?: boolean;
}

export function useSchools({ filters, enabled = true }: UseSchoolsOptions = {}) {
  return useInfiniteQuery<SchoolsResponse>({
    queryKey: discoveryKeys.schools(filters),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.language) params.set('language', filters.language);
      if (filters?.level) params.set('level', filters.level);
      if (filters?.type) params.set('type', filters.type);
      if (pageParam) params.set('cursor', pageParam as string);

      const res = await fetch(`/api/discovery/schools?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch schools');
      return res.json() as Promise<SchoolsResponse>;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.nextCursor : undefined,
    staleTime: 60_000,
    enabled,
  });
}
