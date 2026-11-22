import 'server-only';

import { cache } from 'react';

import { getSchool } from '@/features/school/api/get-school';
import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';

import type { SchoolLifecycleFields, SchoolLifecycleStatus } from '../types';

export interface WorkspaceLifecycle {
  status: SchoolLifecycleStatus | undefined;
  closesAt: string | null;
  purgeAt: string | null;
}

/**
 * Where a workspace stands in its lifecycle — a school or a tutor's SOLO alike (plan 90, live
 * check, block 9). One read per request: the layout draws the banner from it and the pages decide
 * which controls to offer. Null when the school is not readable; the caller treats that as open.
 */
export const getWorkspaceLifecycle = cache(async function (
  workspaceId: string,
): Promise<WorkspaceLifecycle | null> {
  const school: SchoolLifecycleFields | null = await getSchool(workspaceId);
  if (!school) return null;
  return { status: school.status, closesAt: school.closesAt ?? null, purgeAt: school.purgeAt ?? null };
});

/**
 * Whether a workspace takes changes, by the page's `workspaceId` param (an id or a school's slug).
 * Unknown status counts as open — the services still refuse.
 */
export async function isWorkspaceWritable(workspaceRef: string): Promise<boolean> {
  const workspace = await resolveWorkspace(workspaceRef);
  if (!workspace) return true;
  const lifecycle = await getWorkspaceLifecycle(workspace.id);
  return isWritableStatus(lifecycle?.status);
}

export function isWritableStatus(status: SchoolLifecycleStatus | undefined): boolean {
  return !status || status === 'active';
}
