'use client';

import { useQuery } from '@tanstack/react-query';

import type { StudentHistoryItem } from '../types';
import { studentKeys } from './keys';

/** Finished courses for the «History» section of "My courses". */
export function useMyHistory() {
  return useQuery<StudentHistoryItem[]>({
    queryKey: studentKeys.myHistory(),
    queryFn: async () => {
      const res = await fetch('/api/student/my-history');
      if (!res.ok) throw new Error('Failed to fetch history');
      return res.json() as Promise<StudentHistoryItem[]>;
    },
    staleTime: 60_000,
  });
}
