'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { StudentProfile, UpdateStudentProfileInput } from '../types';
import { profileKeys } from './keys';

export function useMyStudentProfile() {
  return useQuery<StudentProfile | null>({
    queryKey: profileKeys.studentMe(),
    queryFn: async () => {
      const res = await fetch('/api/profile/me/student');
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch student profile');
      return res.json() as Promise<StudentProfile>;
    },
    staleTime: 60_000,
  });
}

export function useUpdateStudentProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateStudentProfileInput) => {
      const res = await fetch('/api/profile/me/student', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to update student profile');
      return res.json() as Promise<StudentProfile>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.studentMe() });
    },
  });
}
