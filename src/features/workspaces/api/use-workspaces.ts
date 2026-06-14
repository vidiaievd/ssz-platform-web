'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { WorkspacesResponse, WorkspaceContext } from '../types';

export const workspacesKeys = {
  all: () => ['workspaces'] as const,
};

async function fetchWorkspaces(): Promise<WorkspacesResponse> {
  const res = await fetch('/api/bff/me/workspaces');
  if (!res.ok) throw new Error('Failed to fetch workspaces');
  return res.json() as Promise<WorkspacesResponse>;
}

async function activateWorkspace(contextKey: string): Promise<void> {
  await fetch('/api/bff/me/workspaces/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contextKey }),
  });
}

export function useWorkspaces() {
  return useQuery({
    queryKey: workspacesKeys.all(),
    queryFn: fetchWorkspaces,
    staleTime: 30_000,
    gcTime: 300_000,
  });
}

export function useActivateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: activateWorkspace,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspacesKeys.all() });
    },
  });
}

export function contextToUrl(ctx: WorkspaceContext, locale: string, userId?: string): string {
  if (ctx.type === 'school') return `/${locale}/school/${ctx.schoolSlug}/dashboard`;
  if (ctx.type === 'private_tutor') return `/${locale}/tutor/${userId ?? ctx.tutorGroupId}/dashboard`;
  return `/${locale}/student/dashboard`;
}
