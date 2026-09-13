'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { WorkspacesResponse, WorkspaceContext } from '../types';
import { wsHref } from '../lib/href';

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

export function contextToUrl(ctx: WorkspaceContext, locale: string): string {
  if (ctx.type === 'school') return `/${locale}${wsHref(ctx.schoolSlug, 'dashboard')}`;
  // The tutor's own index resolves their workspace and lands inside it. Building
  // `/w/<id>/…` here is not possible: the switcher knows the tutor's group, not the
  // workspace that holds it (plan 61, phase 4).
  if (ctx.type === 'private_tutor') return `/${locale}/tutor`;
  return `/${locale}/student/dashboard`;
}
