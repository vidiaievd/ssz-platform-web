import 'server-only';

import type { AuthTokensResponse } from '@/lib/api/generated/schemas';
import { env } from '@/lib/env';

import { clearAuthCookies, readRefreshToken, writeAuthCookies } from './cookies';
import { resolveServiceUrl } from '../api/services';

// Single-flight lock: deduplicates concurrent refresh calls within one process.
// All 401s that fire in parallel await the same promise instead of each
// triggering a separate refresh request.
let inflight: Promise<boolean> | null = null;

export async function attemptRefresh(): Promise<boolean> {
  if (inflight) return inflight;
  inflight = doRefresh().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) {
    await tryClearAuthCookies();
    return false;
  }

  try {
    const base = resolveServiceUrl('auth');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.UPSTREAM_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${base}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
        cache: 'no-store',
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      await tryClearAuthCookies();
      return false;
    }

    const tokens = (await res.json()) as AuthTokensResponse;
    await writeAuthCookies({
      accessToken: tokens.accessToken!,
      refreshToken: tokens.refreshToken!,
    });
    return true;
  } catch {
    await tryClearAuthCookies();
    return false;
  }
}

// cookies().delete() is only allowed in Server Actions and Route Handlers.
// When attemptRefresh() is called during Server Component rendering (e.g. from
// getCurrentUser), the clear is skipped — stale cookies expire on their own.
async function tryClearAuthCookies(): Promise<void> {
  try {
    await clearAuthCookies();
  } catch {
    // not a Server Action / Route Handler context — ignore
  }
}
