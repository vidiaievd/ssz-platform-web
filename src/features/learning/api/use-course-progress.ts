'use client';

import { useQuery } from '@tanstack/react-query';

import type { CourseProgress } from '../types';
import { learningKeys } from './keys';

export function useCourseProgress(courseId: string) {
  return useQuery<CourseProgress>({
    queryKey: learningKeys.courseProgress(courseId),
    queryFn: async () => {
      const res = await fetch(`/api/learning/progress/course/${courseId}`);
      if (res.status === 401) throw new Error('Unauthenticated');
      if (res.status === 404) throw new Error('Course not found');
      if (!res.ok) throw new Error('Failed to fetch course progress');
      return res.json() as Promise<CourseProgress>;
    },
    staleTime: 60_000,
    enabled: !!courseId,
  });
}
