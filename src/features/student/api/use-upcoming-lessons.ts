'use client';

import { useQuery } from '@tanstack/react-query';

import type { LessonPreview } from '../types';
import { studentKeys } from './keys';

export function useUpcomingLessons() {
  return useQuery<LessonPreview[]>({
    queryKey: studentKeys.upcoming(),
    queryFn: async () => {
      const res = await fetch('/api/student/upcoming');
      if (!res.ok) throw new Error('Failed to fetch upcoming lessons');
      return res.json() as Promise<LessonPreview[]>;
    },
    staleTime: 60_000,
  });
}
