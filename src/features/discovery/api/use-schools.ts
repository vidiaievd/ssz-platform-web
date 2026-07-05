'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';

import type { DiscoverFilter } from '../schemas';
import type { SchoolsResponse } from '../types';
import { discoveryKeys } from './keys';

export interface UseSchoolsOptions {
  filters?: DiscoverFilter;
  initialData?: SchoolsResponse;
  enabled?: boolean;
}

export function useSchools({ filters, initialData, enabled = true }: UseSchoolsOptions = {}) {
  return useInfiniteQuery<SchoolsResponse>({
    queryKey: discoveryKeys.schools(filters),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (filters?.q) params.set('q', filters.q);
      if (filters?.type) params.set('type', filters.type);
      if (filters?.sort) params.set('sort', filters.sort);
      if (pageParam) params.set('cursor', pageParam as string);

      const res = await fetch(`/api/discovery/schools?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch schools');
      return res.json() as Promise<SchoolsResponse>;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined,
    initialData: initialData
      ? ({
          pages: [initialData],
          pageParams: [undefined],
        } satisfies InfiniteData<SchoolsResponse>)
      : undefined,
    staleTime: 60_000,
    enabled,
  });
}
