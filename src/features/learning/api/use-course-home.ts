'use client';

import { useQuery } from '@tanstack/react-query';

import type { CourseHomePayload } from '../types';
import { learningKeys } from './keys';

/** Error message when the school that owns the course is closed (409 SCHOOL_NOT_ACTIVE). */
export const COURSE_SCHOOL_CLOSED = 'COURSE_SCHOOL_CLOSED';

export function useCourseHome(courseId: string) {
  return useQuery<CourseHomePayload>({
    queryKey: learningKeys.courseHome(courseId),
    queryFn: async () => {
      const res = await fetch(`/api/learning/course-home/${encodeURIComponent(courseId)}`);
      if (res.status === 401) throw new Error('Unauthenticated');
      if (res.status === 404) throw new Error('Course not found');
      if (res.status === 409) throw new Error(COURSE_SCHOOL_CLOSED);
      if (!res.ok) throw new Error('Failed to load course home');
      return res.json() as Promise<CourseHomePayload>;
    },
    staleTime: 60_000,
    enabled: !!courseId,
    retry: (count, err) => err.message !== COURSE_SCHOOL_CLOSED && count < 3,
  });
}
