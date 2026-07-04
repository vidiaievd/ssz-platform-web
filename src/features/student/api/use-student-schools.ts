'use client';

import { useQuery } from '@tanstack/react-query';

import type { StudentSchool } from '../types';
import { studentKeys } from './keys';

export function useStudentSchools() {
  return useQuery<StudentSchool[]>({
    queryKey: studentKeys.schools(),
    queryFn: async () => {
      const res = await fetch('/api/student/schools');
      if (!res.ok) throw new Error('Failed to fetch schools');
      return res.json() as Promise<StudentSchool[]>;
    },
    staleTime: 60_000,
  });
}
