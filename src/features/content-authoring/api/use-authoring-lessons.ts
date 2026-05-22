'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContainerItem, LessonVariant } from '@/features/content/types';

import { authoringKeys } from './keys';

export function useAuthoringLessons(containerId: string, enabled = true) {
  return useQuery<ContainerItem[]>({
    queryKey: authoringKeys.lessons(containerId),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/${containerId}/items?draft=true`);
      if (!res.ok) throw new Error('Failed to fetch lessons');
      const items: ContainerItem[] = await res.json();
      return items.filter((item) => item.contentType === 'LESSON');
    },
    enabled: enabled && !!containerId,
    staleTime: 30_000,
  });
}

export function useLessonVariants(lessonId: string, enabled = true) {
  return useQuery<LessonVariant[]>({
    queryKey: authoringKeys.lessonVariants(lessonId),
    queryFn: async () => {
      const res = await fetch(`/api/content/lessons/${lessonId}/variants`);
      if (!res.ok) return [];
      return res.json() as Promise<LessonVariant[]>;
    },
    enabled: enabled && !!lessonId,
    staleTime: 60_000,
  });
}
