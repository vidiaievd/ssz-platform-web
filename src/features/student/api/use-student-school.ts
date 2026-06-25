'use client';

import { useQuery } from '@tanstack/react-query';

import type { StudentSchool } from '../types';
import { studentKeys } from './keys';

export function useStudentSchool(schoolSlug: string) {
  return useQuery<StudentSchool>({
    queryKey: studentKeys.school(schoolSlug),
    queryFn: async () => {
      const res = await fetch(`/api/student/schools/${schoolSlug}`);
      if (!res.ok) throw new Error('Failed to fetch school');
      return res.json() as Promise<StudentSchool>;
    },
    enabled: !!schoolSlug,
    staleTime: 60_000,
  });
}
