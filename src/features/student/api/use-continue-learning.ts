'use client';

import { useQuery } from '@tanstack/react-query';

import type { ContainerProgress } from '../types';
import { studentKeys } from './keys';

export function useContinueLearning() {
  return useQuery<ContainerProgress[]>({
    queryKey: studentKeys.progress(),
    queryFn: async () => {
      const res = await fetch('/api/student/progress');
      if (!res.ok) throw new Error('Failed to fetch progress');
      return res.json() as Promise<ContainerProgress[]>;
    },
    staleTime: 60_000,
  });
}
