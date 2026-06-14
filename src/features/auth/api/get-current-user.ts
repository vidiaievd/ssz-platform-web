import 'server-only';

import { cache } from 'react';

import { readAccessToken } from '@/lib/auth/cookies';
import { decodeJwtPayload } from '@/lib/auth/decode-jwt';
import { serverFetch } from '@/lib/api/server-fetcher';
import type { UserRolesResponse } from '@/lib/api/generated/schemas';
import type { CurrentUser } from '../types/current-user';

export const getCurrentUser = cache(async function (): Promise<CurrentUser | null> {
  const token = await readAccessToken();
  if (!token) return null;

  // Decode JWT payload for email_verified + sub (userId) claims — routing only.
  const payload = decodeJwtPayload(token);
  const emailVerified =
    typeof payload?.email_verified === 'boolean' ? payload.email_verified : undefined;
  const userId = typeof payload?.sub === 'string' ? payload.sub : undefined;
  const email = typeof payload?.email === 'string' ? payload.email : undefined;

  try {
    const data = await serverFetch<UserRolesResponse>({
      service: 'auth',
      path: '/auth/roles',
    });
    return { roles: data.roles ?? [], emailVerified, userId, email };
  } catch {
    return null;
  }
});
