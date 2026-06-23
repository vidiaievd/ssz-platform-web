'use client';

import { useQuery } from '@tanstack/react-query';

import type { Container } from '@/features/content/types';

type Params = {
  search?: string;
  pageSize?: number;
};

/**
 * Courses a group can be linked to: public courses, the admin's own, and
 * school-private courses for schools they belong to — the same visibility
 * scope content-service's catalog already resolves server-side when no
 * ownerUserId filter is applied. Deliberately does NOT use the "my
 * containers" (scope=owned) hook, which only returns content the current
 * user personally authored — too narrow for a school admin assigning a
 * course authored by one of their teachers.
 */
export function useAssignableCourses({ search, pageSize = 20 }: Params = {}) {
  return useQuery<{ items: Container[] }>({
    queryKey: ['groups', 'assignable-courses', { search, pageSize }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', String(pageSize));
      params.set('sort', 'updated_at_desc');

      const res = await fetch(`/api/content/containers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch courses');

      const raw = (await res.json()) as { items: Container[] };
      // Container state (draft/published) has no server-side filter — only published
      // courses are assignable to a group.
      const items = raw.items.filter((c) => !!c.currentPublishedVersionId);
      return { items };
    },
    staleTime: 30_000,
  });
}
