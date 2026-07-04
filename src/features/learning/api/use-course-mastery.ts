'use client';

import { useQuery } from '@tanstack/react-query';

import type { CourseMastery } from '../types';
import { learningKeys } from './keys';

export function useCourseMastery(courseId: string) {
  return useQuery<CourseMastery>({
    queryKey: learningKeys.courseMastery(courseId),
    queryFn: async () => {
      const res = await fetch(`/api/learning/mastery/course/${courseId}`);
      if (res.status === 401) throw new Error('Unauthenticated');
      if (res.status === 404) throw new Error('Course not found');
      if (!res.ok) throw new Error('Failed to fetch course mastery');
      return res.json() as Promise<CourseMastery>;
    },
    staleTime: 5 * 60_000,
    enabled: !!courseId,
  });
}
