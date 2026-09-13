'use client';

import { useParams } from 'next/navigation';

/**
 * The workspace the current screen stands in, as its address spells it.
 *
 * Components must not care which tree they were rendered from: while the move is under
 * way the same screen can arrive as `/w/<workspaceId>/…` or, for a section that has not
 * moved yet, as `/school/<slug>/…`. Both are the segment `wsHref` wants back, so this
 * returns whichever the route provided.
 */
export function useWorkspaceRef(): string {
  const params = useParams<{ workspaceId?: string; schoolSlug?: string }>();
  return params.workspaceId ?? params.schoolSlug ?? '';
}
