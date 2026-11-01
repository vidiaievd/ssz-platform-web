'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keyFactory } from '@/lib/query/keys';

import type { AiPrecheckSettings } from '../types/ai-precheck';

export const aiPrecheckKeys = keyFactory('ai-precheck', {
  school: (school: string) => ['school', school] as const,
});

/** Why a save was refused, as the form tells it: the plan, a value out of range, or neither. */
export class AiPrecheckSaveError extends Error {
  constructor(readonly reason: 'not_entitled' | 'invalid_settings' | 'other') {
    super('Failed to save the check settings');
  }
}

export function useAiPrecheck(school: string) {
  return useQuery<AiPrecheckSettings>({
    queryKey: aiPrecheckKeys.school(school),
    queryFn: async () => {
      const response = await fetch(`/api/schools/${encodeURIComponent(school)}/ai-precheck`);
      if (!response.ok) throw new Error('Failed to read the check settings');
      return response.json() as Promise<AiPrecheckSettings>;
    },
    enabled: school !== '',
    staleTime: 60_000,
  });
}

export function useSaveAiPrecheck(school: string) {
  const queryClient = useQueryClient();

  return useMutation<AiPrecheckSettings, AiPrecheckSaveError, AiPrecheckSettings>({
    mutationFn: async (settings) => {
      const response = await fetch(`/api/schools/${encodeURIComponent(school)}/ai-precheck`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        if (response.status === 403 && body?.error === 'not_entitled') {
          throw new AiPrecheckSaveError('not_entitled');
        }
        if (response.status === 422 && body?.error === 'invalid_settings') {
          throw new AiPrecheckSaveError('invalid_settings');
        }
        throw new AiPrecheckSaveError('other');
      }
      return response.json() as Promise<AiPrecheckSettings>;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(aiPrecheckKeys.school(school), settings);
    },
  });
}
