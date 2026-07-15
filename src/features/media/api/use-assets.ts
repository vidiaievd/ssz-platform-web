'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { MediaAsset } from '../types';
import { mediaKeys } from './keys';

export function useMyAssets() {
  return useQuery({
    queryKey: mediaKeys.assets(),
    queryFn: async () => {
      const res = await fetch('/api/media/assets');
      if (!res.ok) throw new Error('Failed to fetch assets');
      const data = (await res.json()) as { items: MediaAsset[] };
      return data.items ?? [];
    },
  });
}

export function useMediaAsset(id: string | undefined) {
  return useQuery({
    queryKey: mediaKeys.asset(id ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/media/assets/${id}`);
      if (!res.ok) throw new Error('Failed to fetch asset');
      return res.json() as Promise<Pick<MediaAsset, 'id' | 'url'>>;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/media/assets/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error('Failed to delete asset');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.assets() });
    },
  });
}
