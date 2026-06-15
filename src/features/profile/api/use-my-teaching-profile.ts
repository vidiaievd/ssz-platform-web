'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { TeachingProfile } from '../types';
import { profileKeys } from './keys';

export function useMyTeachingProfile() {
  return useQuery<TeachingProfile | null>({
    queryKey: profileKeys.teachingMe(),
    queryFn: async () => {
      const res = await fetch('/api/profile/me/teaching');
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch teaching profile');
      return res.json() as Promise<TeachingProfile>;
    },
    staleTime: 60_000,
  });
}

export function useAddTeachingLanguage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, level }: { code: string; level: string }) => {
      const res = await fetch('/api/profile/me/teaching/languages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, level }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(json.error ?? 'Failed to add language');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.teachingMe() });
    },
  });
}

export function useRemoveTeachingLanguage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch(`/api/profile/me/teaching/languages/${code}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 404) throw new Error('Failed to remove language');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.teachingMe() });
    },
  });
}

export function useEnsureTeachingProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/profile/me/teaching', { method: 'POST' });
      if (!res.ok && res.status !== 409) throw new Error('Failed to create teaching profile');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.teachingMe() });
    },
  });
}
