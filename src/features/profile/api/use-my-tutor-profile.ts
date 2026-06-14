'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { TutorProfile, UpdateTutorProfileInput } from '../types';
import { profileKeys } from './keys';

export function useMyTutorProfile() {
  return useQuery<TutorProfile | null>({
    queryKey: profileKeys.tutorMe(),
    queryFn: async () => {
      const res = await fetch('/api/profile/me/tutor');
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch tutor profile');
      return res.json() as Promise<TutorProfile>;
    },
    staleTime: 60_000,
  });
}

export function useUpdateTutorProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTutorProfileInput) => {
      const res = await fetch('/api/profile/me/tutor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to update tutor profile');
      return res.json() as Promise<TutorProfile>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.tutorMe() });
    },
  });
}
