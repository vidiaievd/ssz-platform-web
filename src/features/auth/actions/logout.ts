'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { ok } from '@/lib/result';

export async function logoutAction() {
  try {
    await serverFetch({
      service: 'auth',
      path: '/api/v1/auth/logout',
      method: 'POST',
    });
  } catch {
    // best-effort — clear cookies regardless of API response
  }

  await clearAuthCookies();
  return ok(undefined);
}
