'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keyFactory } from '@/lib/query/keys';

import type { AssistantAccess } from '../types/assistant-access';

export const assistantAccessKeys = keyFactory('assistant-access', {
  school: (school: string) => ['school', school] as const,
});

/**
 * Why a save was refused, as the form needs to tell it: the plan, a group or student
 * that is no longer the school's, or neither.
 */
export class AssistantAccessSaveError extends Error {
  constructor(readonly reason: 'not_entitled' | 'invalid_access' | 'other') {
    super('Failed to save the assistant settings');
  }
}

export function useAssistantAccess(school: string) {
  return useQuery<AssistantAccess>({
    queryKey: assistantAccessKeys.school(school),
    queryFn: async () => {
      const response = await fetch(`/api/schools/${encodeURIComponent(school)}/assistant-access`);
      if (!response.ok) throw new Error('Failed to read the assistant settings');
      return response.json() as Promise<AssistantAccess>;
    },
    enabled: school !== '',
    staleTime: 60_000,
  });
}

export function useSaveAssistantAccess(school: string) {
  const queryClient = useQueryClient();

  return useMutation<AssistantAccess, AssistantAccessSaveError, AssistantAccess>({
    mutationFn: async (access) => {
      const response = await fetch(`/api/schools/${encodeURIComponent(school)}/assistant-access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(access),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        if (response.status === 403 && body?.error === 'not_entitled') {
          throw new AssistantAccessSaveError('not_entitled');
        }
        if (response.status === 422 && body?.error === 'invalid_access') {
          throw new AssistantAccessSaveError('invalid_access');
        }
        throw new AssistantAccessSaveError('other');
      }
      return response.json() as Promise<AssistantAccess>;
    },
    onSuccess: (access) => {
      // The service's answer, not the draft: it drops duplicates and anything gone since.
      queryClient.setQueryData(assistantAccessKeys.school(school), access);
    },
  });
}
