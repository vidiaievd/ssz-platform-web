import 'server-only';

import { readAccessToken } from '@/lib/auth/cookies';
import { serverFetch } from '@/lib/api/server-fetcher';
import type { UserRolesResponse } from '@/lib/api/generated/schemas';
import type { CurrentUser } from '../types/current-user';

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await readAccessToken();
  if (!token) return null;

  try {
    const data = await serverFetch<UserRolesResponse>({
      service: 'auth',
      path: '/api/v1/auth/roles',
    });
    return { roles: data.roles ?? [] };
  } catch {
    return null;
  }
}
