'use client';

import { useQuery } from '@tanstack/react-query';

import type { ActivityStreak } from '../types';
import { studentKeys } from './keys';

export function useActivityStreak() {
  return useQuery<ActivityStreak>({
    queryKey: studentKeys.streak(),
    queryFn: async () => {
      const res = await fetch('/api/student/streak');
      if (!res.ok) throw new Error('Failed to fetch streak');
      return res.json() as Promise<ActivityStreak>;
    },
    staleTime: 5 * 60_000,
  });
}
