'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AssetResponse, MediaAsset, NarrationDefaults } from '../types';
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

/** Statuses after which an asset no longer changes on its own. */
const SETTLED_STATUSES = new Set(['READY', 'FAILED', 'DELETED']);
const PENDING_POLL_MS = 2_000;

export function useMediaAsset(
  id: string | undefined,
  options: { pollWhilePending?: boolean } = {},
) {
  return useQuery({
    queryKey: mediaKeys.asset(id ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/media/assets/${id}`);
      if (!res.ok) throw new Error('Failed to fetch asset');
      return res.json() as Promise<AssetResponse>;
    },
    enabled: !!id,
    staleTime: 60_000,
    // A narration is being spoken, or an upload processed: ask again until it settles.
    refetchInterval: (query) =>
      options.pollWhilePending &&
      query.state.data &&
      !SETTLED_STATUSES.has(query.state.data.status ?? 'READY')
        ? PENDING_POLL_MS
        : false,
  });
}

/** The lesson asset `id` replaced, while it can still be restored; null when there is none. */
export function usePreviousAsset(id: string | undefined) {
  return useQuery({
    queryKey: mediaKeys.previous(id ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/media/assets/${id}/previous`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch the previous asset');
      return res.json() as Promise<AssetResponse>;
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

/**
 * Default narration pace per course level, and the range each setting accepts. The table is
 * media-service's, so a change of defaults there reaches the editor without a release.
 */
export function useNarrationDefaults() {
  return useQuery({
    queryKey: mediaKeys.narrationDefaults(),
    queryFn: async () => {
      const res = await fetch('/api/media/narration/defaults');
      if (!res.ok) throw new Error('Failed to fetch narration defaults');
      return res.json() as Promise<NarrationDefaults>;
    },
    staleTime: 10 * 60_000,
  });
}
