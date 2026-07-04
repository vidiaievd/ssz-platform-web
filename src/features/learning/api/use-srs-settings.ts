'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import type { SrsSettings } from '../types';
import { learningKeys } from './keys';

const SETTINGS_KEY = () => [...learningKeys.srsDue(), 'settings'] as const;

export function useSrsSettings() {
  return useQuery<SrsSettings>({
    queryKey: SETTINGS_KEY(),
    queryFn: async () => {
      const res = await fetch('/api/learning/srs/settings');
      if (res.status === 401) throw new Error('Unauthenticated');
      if (!res.ok) throw new Error('Failed to fetch SRS settings');
      return res.json() as Promise<SrsSettings>;
    },
    staleTime: 60_000,
  });
}

export function usePatchSrsSettings() {
  const queryClient = useQueryClient();
  const t = useTranslations('Srs.toast');

  return useMutation<SrsSettings, Error, Partial<SrsSettings>>({
    mutationFn: async (patch) => {
      const res = await fetch('/api/learning/srs/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.status === 401) throw new Error('Unauthenticated');
      if (!res.ok) throw new Error('Failed to update SRS settings');
      return res.json() as Promise<SrsSettings>;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: SETTINGS_KEY() });
      const prev = queryClient.getQueryData<SrsSettings>(SETTINGS_KEY());
      if (prev) {
        queryClient.setQueryData<SrsSettings>(SETTINGS_KEY(), { ...prev, ...patch });
      }
      return { prev };
    },
    onError: (_err, _patch, context) => {
      const ctx = context as { prev?: SrsSettings } | undefined;
      if (ctx?.prev) {
        queryClient.setQueryData<SrsSettings>(SETTINGS_KEY(), ctx.prev);
      }
      toast.error(t('settingsError'));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY() });
    },
  });
}
