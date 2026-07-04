'use client';

import { useQuery } from '@tanstack/react-query';

import type { ProgressOverview } from '../types';
import { learningKeys } from './keys';

export function useProgressOverview(courseId?: string) {
  return useQuery<ProgressOverview>({
    queryKey: learningKeys.progressOverview(courseId),
    queryFn: async () => {
      const url = courseId
        ? `/api/learning/progress/overview?courseId=${encodeURIComponent(courseId)}`
        : '/api/learning/progress/overview';
      const res = await fetch(url);
      if (res.status === 401) throw new Error('Unauthenticated');
      if (!res.ok) throw new Error('Failed to fetch progress overview');
      return res.json() as Promise<ProgressOverview>;
    },
    staleTime: 5 * 60_000,
  });
}
