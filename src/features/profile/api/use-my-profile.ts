'use client';

import { useQuery } from '@tanstack/react-query';

import type { Profile } from '../types';
import { profileKeys } from './keys';

export function useMyProfile() {
  return useQuery<Profile | null>({
    queryKey: profileKeys.me(),
    queryFn: async () => {
      const res = await fetch('/api/profile/me');
      if (res.status === 204) return null;
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json() as Promise<Profile>;
    },
    staleTime: 60_000,
  });
}
