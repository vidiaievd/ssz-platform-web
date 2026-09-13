import 'server-only';

import { cache } from 'react';

import { AppError } from '@/lib/errors/app-error';
import { serverFetch } from '@/lib/api/server-fetcher';
import { readAccessToken } from '@/lib/auth/cookies';
import type { SchoolRole } from '@/features/school/types';

export type WorkspaceKind = 'SCHOOL' | 'SOLO';

/**
 * One place a person works from, resolved from its address.
 *
 * A school and a private tutor's own space answer the same shape on purpose: the screens
 * they share are addressed by workspace (`/w/<id>/…`), and what the shell draws and what
 * the page lets you do follow from `kind` and `myRole` — never from the shape of the URL
 * (plan 61).
 */
export interface ResolvedWorkspace {
  id: string;
  kind: WorkspaceKind;
  name: string;
  /** A school's URL slug, kept for links that still carry one. Null for a solo workspace. */
  slug: string | null;
  /** The caller's standing here. `OWNER` for the person who owns it, roster row or not. */
  myRole: SchoolRole;
}

/**
 * Resolve one workspace for the signed-in user, or null when it is not theirs.
 *
 * Null is deliberately the only negative answer: the server already refuses to distinguish
 * "no such workspace" from "not yours", so a caller cannot probe for which schools exist,
 * and every screen turns both into the same 404.
 */
export const resolveWorkspace = cache(async function (
  idOrSlug: string,
): Promise<ResolvedWorkspace | null> {
  const token = await readAccessToken();
  if (!token) return null;

  try {
    return await serverFetch<ResolvedWorkspace>({
      service: 'organization',
      path: `/workspaces/${encodeURIComponent(idOrSlug)}`,
      // Not a failure: a signed-in person asking about a workspace that is not theirs is
      // an ordinary 404, and every caller here renders it as one.
      expectedErrorStatuses: [403, 404],
    });
  } catch (err) {
    // Only a refusal means "not yours". An outage must not be dressed up as a 404, or a
    // dead organization-service would quietly look like every workspace being deleted.
    if (err instanceof AppError && (err.code === 'not_found' || err.code === 'forbidden')) {
      return null;
    }
    throw err;
  }
});
