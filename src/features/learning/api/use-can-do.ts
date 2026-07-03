'use client';

import { useQuery } from '@tanstack/react-query';

import type { CanDoResponse } from '../types';
import { learningKeys } from './keys';

export function useCanDo(courseId?: string) {
  return useQuery<CanDoResponse>({
    queryKey: learningKeys.canDo(courseId),
    queryFn: async () => {
      const url = courseId
        ? `/api/learning/can-do?courseId=${encodeURIComponent(courseId)}`
        : '/api/learning/can-do';
      const res = await fetch(url);
      if (res.status === 401) throw new Error('Unauthenticated');
      if (!res.ok) throw new Error('Failed to fetch can-do items');
      return res.json() as Promise<CanDoResponse>;
    },
    staleTime: 5 * 60_000,
  });
}
