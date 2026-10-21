import 'server-only';

import { cache } from 'react';

import { serverFetch } from '@/lib/api/server-fetcher';

import type { Entitlements } from '../types';

/**
 * The rights of the context a screen stands in: a workspace from `/w/<id>`, or — with no
 * id — the signed-in person on their own.
 *
 * Null whenever they could not be read, whatever the reason. The rights only decide which
 * controls are drawn (plan 78 §7); a page must still render with subscription-service
 * down, it just renders without the paid controls — and the service behind each of them
 * checks the rights itself, so nothing is let through by guessing.
 */
export const getEntitlements = cache(async function (
  workspaceId?: string,
): Promise<Entitlements | null> {
  try {
    return await serverFetch<Entitlements>({
      service: 'subscription',
      path: '/subscriptions/me',
      query: workspaceId ? { workspaceId } : undefined,
      // Not a member, or membership could not be checked: both mean "no rights to show".
      expectedErrorStatuses: [403, 503],
    });
  } catch {
    return null;
  }
});
