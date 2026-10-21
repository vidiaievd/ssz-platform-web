'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keyFactory } from '@/lib/query/keys';

import type { TokenLifetimeChange, TokenLifetimes } from '../types/token-lifetimes';

export const tokenLifetimeKeys = keyFactory('token-lifetimes', {
  all: () => ['all'] as const,
});

export function useTokenLifetimes() {
  return useQuery<TokenLifetimes>({
    queryKey: tokenLifetimeKeys.all(),
    queryFn: async () => {
      const response = await fetch('/api/admin/token-lifetimes');
      if (!response.ok) throw new Error('Failed to read session lifetimes');
      return response.json() as Promise<TokenLifetimes>;
    },
    staleTime: 60_000,
  });
}

/** Sends only the cells that changed; the service answers with every lifetime. */
export function useSaveTokenLifetimes() {
  const queryClient = useQueryClient();

  return useMutation<TokenLifetimes, Error, TokenLifetimeChange[]>({
    mutationFn: async (policies) => {
      const response = await fetch('/api/admin/token-lifetimes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policies }),
      });
      if (!response.ok) throw new Error('Failed to save session lifetimes');
      return response.json() as Promise<TokenLifetimes>;
    },
    onSuccess: (lifetimes) => {
      queryClient.setQueryData(tokenLifetimeKeys.all(), lifetimes);
    },
  });
}
