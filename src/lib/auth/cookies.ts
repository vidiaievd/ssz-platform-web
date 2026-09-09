import 'server-only';

import { cookies } from 'next/headers';

import { decodeJwtPayload } from './decode-jwt';

const ACCESS_TOKEN = 'ssz_at';
const REFRESH_TOKEN = 'ssz_rt';

/*
  A cookie lives exactly as long as the token inside it, and not a minute longer.

  It used to hold the access token for two hours while auth-service issued it for
  fifteen minutes, and the refresh token for thirty days against a lifetime of seven.
  That gap is not cosmetic: `proxy.ts` decides whether somebody is signed in by whether
  the cookie is *there*, so for one hour and forty-five minutes the app believed in a
  session that had already expired — every render behind it failed on a 401.

  The lifetime is taken from the token itself (the `exp` claim, or the expiry the service
  returned alongside it) rather than restated here, so a change to `AuthOptions` on the
  server needs no matching change in this file. The constants below are only what to
  assume when a token cannot be read; they mirror the service's defaults.
*/
const ACCESS_FALLBACK = 60 * 15;
const REFRESH_FALLBACK = 60 * 60 * 24 * 7;

/** Seconds from now until an ISO timestamp, or `null` if it is unusable or past. */
function secondsUntil(iso: string | undefined): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  const seconds = Math.floor((at - Date.now()) / 1000);
  return seconds > 0 ? seconds : null;
}

/** The same question asked of a JWT's own `exp`, which is the more reliable of the two. */
function secondsUntilExpiry(token: string): number | null {
  const exp = decodeJwtPayload(token)?.['exp'];
  if (typeof exp !== 'number') return null;
  const seconds = Math.floor(exp - Date.now() / 1000);
  return seconds > 0 ? seconds : null;
}

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
  /** What auth-service said about these two, when the caller has it. */
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
}): Promise<void> {
  const store = await cookies();
  const access =
    secondsUntilExpiry(input.accessToken) ??
    secondsUntil(input.accessTokenExpiresAt) ??
    ACCESS_FALLBACK;
  const refresh = secondsUntil(input.refreshTokenExpiresAt) ?? REFRESH_FALLBACK;

  store.set(ACCESS_TOKEN, input.accessToken, { ...baseOptions, maxAge: access });
  store.set(REFRESH_TOKEN, input.refreshToken, { ...baseOptions, maxAge: refresh });
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
    // Rewritten with the lifetime the cookie already carries, which the store does not
    // expose — so the fallback stands in. A probe on a cookie that is about to be
    // replaced by the refresh it guards; where the refresh is refused, it costs one
    // renewed expiry on a token whose own expiry the server still enforces.
    store.set(REFRESH_TOKEN, current.value, { ...baseOptions, maxAge: REFRESH_FALLBACK });
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
