'use client';

import { useParams } from 'next/navigation';

/**
 * The workspace the current screen stands in, as its address spells it.
 *
 * A component has no business knowing which route rendered it, and after the move there
 * is only one that can: every staff screen lives under `/w/<workspaceId>/…`, and the old
 * tree is a redirect with nothing under it.
 */
export function useWorkspaceRef(): string {
  const params = useParams<{ workspaceId?: string }>();
  return params.workspaceId ?? '';
}
