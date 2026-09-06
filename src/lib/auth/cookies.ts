import 'server-only';

import { cookies } from 'next/headers';

const ACCESS_TOKEN = 'ssz_at';
const REFRESH_TOKEN = 'ssz_rt';

const TWO_HOURS = 60 * 60 * 2;
const THIRTY_DAYS = 60 * 60 * 24 * 30;

const baseOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function readAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_TOKEN)?.value;
}

export async function readRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_TOKEN)?.value;
}

export async function writeAuthCookies(input: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_TOKEN, input.accessToken, { ...baseOptions, maxAge: TWO_HOURS });
  store.set(REFRESH_TOKEN, input.refreshToken, { ...baseOptions, maxAge: THIRTY_DAYS });
}

/**
 * Whether this context may write cookies at all — Server Action or Route Handler, not a
 * Server Component render.
 *
 * Asked **before** a refresh, not after it, and that ordering is the whole point.
 * Refreshing rotates: the server revokes the token it was given and issues a new one. A
 * rotation whose result cannot be stored is worse than no refresh at all — the browser
 * keeps a token the server has already revoked, and presenting it again is read as theft,
 * which revokes the whole family and ends every session the user has (auth-service
 * `RefreshTokenCommandHandler`). Found live 2026-09-06: saving in the exercise editor
 * died with "Session expired" after a page had rendered against an expired access token.
 *
 * The probe rewrites the refresh cookie with the value it already holds, so it costs
 * nothing where it succeeds and throws where writing is forbidden.
 */
export async function canWriteAuthCookies(): Promise<boolean> {
  try {
    const store = await cookies();
    const current = store.get(REFRESH_TOKEN);
    if (!current) return false;
    store.set(REFRESH_TOKEN, current.value, { ...baseOptions, maxAge: THIRTY_DAYS });
    return true;
  } catch {
    return false;
  }
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_TOKEN);
  store.delete(REFRESH_TOKEN);
}

const PENDING_INVITE = 'ssz_pending_invite';
const SEVEN_DAYS = 60 * 60 * 24 * 7;

export async function readPendingInvite(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(PENDING_INVITE)?.value;
}

export async function writePendingInvite(token: string): Promise<void> {
  const store = await cookies();
  store.set(PENDING_INVITE, token, { ...baseOptions, maxAge: SEVEN_DAYS });
}

export async function clearPendingInvite(): Promise<void> {
  const store = await cookies();
  store.delete(PENDING_INVITE);
}
