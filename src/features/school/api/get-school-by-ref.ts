import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { School } from '../types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One school, by whichever of its two names the caller holds.
 *
 * Screens are addressed by workspace id now (plan 61) and links people kept still carry a
 * slug, so a helper that only understood slugs answered "no such school" to every screen
 * in the new tree — a 404 on a school the caller was standing in.
 */
export async function getSchoolByRef(idOrSlug: string): Promise<School | null> {
  if (!idOrSlug) return null;

  const path = UUID.test(idOrSlug) ? `/schools/${idOrSlug}` : `/schools/by-slug/${idOrSlug}`;

  try {
    return await serverFetch<School>({ service: 'organization', path });
  } catch {
    return null;
  }
}
