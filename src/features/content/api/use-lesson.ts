'use client';

import { useQuery } from '@tanstack/react-query';

import type { Lesson, LessonVariant } from '../types';
import { contentKeys } from './keys';

export function useLesson(id: string, enabled = true) {
  return useQuery<Lesson>({
    queryKey: contentKeys.lesson(id),
    queryFn: async () => {
      const res = await fetch(`/api/content/lessons/${id}`);
      if (!res.ok) throw new Error('Failed to fetch lesson');
      return res.json() as Promise<Lesson>;
    },
    staleTime: 120_000,
    enabled: enabled && !!id,
  });
}

export function useBestLessonVariant(lessonId: string, enabled = true) {
  return useQuery<LessonVariant>({
    queryKey: contentKeys.lessonVariant(lessonId),
    queryFn: async () => {
      const res = await fetch(`/api/content/lessons/${lessonId}/variant`);
      if (!res.ok) throw new Error('Failed to fetch lesson variant');
      return res.json() as Promise<LessonVariant>;
    },
    staleTime: 120_000,
    enabled: enabled && !!lessonId,
  });
}
