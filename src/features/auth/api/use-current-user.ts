'use client';

import { useQuery } from '@tanstack/react-query';

import type { CurrentUser } from '../types/current-user';
import { authKeys } from './keys';

export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: authKeys.me(),
    queryFn: async () => {
      const res = await fetch('/api/auth/me');
      if (res.status === 204) return null;
      if (!res.ok) throw new Error('Failed to fetch current user');
      return res.json() as Promise<CurrentUser>;
    },
    staleTime: 60_000,
  });
}
