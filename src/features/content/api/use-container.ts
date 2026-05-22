'use client';

import { useQuery } from '@tanstack/react-query';

import type { Container } from '../types';
import { contentKeys } from './keys';

export function useContainer(id: string, enabled = true) {
  return useQuery<Container>({
    queryKey: contentKeys.container(id),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/${id}`);
      if (!res.ok) throw new Error('Failed to fetch container');
      return res.json() as Promise<Container>;
    },
    staleTime: 60_000,
    enabled: enabled && !!id,
  });
}

export function useContainerBySlug(slug: string, enabled = true) {
  return useQuery<Container>({
    queryKey: contentKeys.containerBySlug(slug),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/slug/${slug}`);
      if (!res.ok) throw new Error('Failed to fetch container');
      return res.json() as Promise<Container>;
    },
    staleTime: 60_000,
    enabled: enabled && !!slug,
  });
}
