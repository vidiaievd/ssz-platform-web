'use client';

import { useQuery } from '@tanstack/react-query';

import type { StudentCourse } from '../types';
import { studentKeys } from './keys';

/**
 * Every course the student can open, started or not. Prefer this over
 * `useContinueLearning` for anything that answers "what do I have" — the
 * progress feed only answers "what have I worked on".
 */
export function useMyCourses() {
  return useQuery<StudentCourse[]>({
    queryKey: studentKeys.myCourses(),
    queryFn: async () => {
      const res = await fetch('/api/student/my-courses');
      if (!res.ok) throw new Error('Failed to fetch courses');
      return res.json() as Promise<StudentCourse[]>;
    },
    staleTime: 60_000,
  });
}
