import { NextResponse, type NextRequest } from 'next/server';

import { readAccessToken } from '@/lib/auth/cookies';
import { attemptRefresh } from '@/lib/auth/refresh';
import { DEFAULT_LOCALE, LOCALES } from '@/lib/i18n/config';

/**
 * Renew the session for a navigation, then send the visitor where they were going.
 *
 * `proxy.ts` sends a page request here when the access-token cookie has expired and the
 * refresh cookie has not. It cannot do the work itself: middleware runs on every request,
 * in isolates that share no state, so a page that fans out ten requests would fan out ten
 * rotations of the same refresh token — and auth-service reads the second presentation of
 * a rotated token as theft and revokes every session the user has.
 *
 * A navigation is one request, and a Route Handler is a place where cookies may be
 * written, so both halves of the problem are solved by moving the refresh here. The
 * single-flight lock inside `attemptRefresh` covers whatever else races with it in this
 * process.
 */

/** The path to return to: same-origin, absolute, and never this route again. */
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  // `//host` and `/\host` are protocol-relative — a redirect off this origin entirely.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  if (raw.startsWith('/api/auth/session/refresh')) return null;
  return raw;
}

/** The locale of the path we were sent from, so the login page speaks the same language. */
function localeOf(next: string | null): string {
  const first = next?.split('/')[1] ?? '';
  return (LOCALES as readonly string[]).includes(first) ? first : DEFAULT_LOCALE;
}

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  const locale = localeOf(next);

  const loginUrl = new URL(`/${locale}/login`, request.url);
  if (next) loginUrl.searchParams.set('redirect', next.slice(locale.length + 1) || '/');

  const refreshed = await attemptRefresh();
  if (!refreshed) return NextResponse.redirect(loginUrl);

  /*
    The renewed token has to be readable before we send anyone back, or the redirect
    lands on a page whose access cookie is still missing — and `proxy.ts` would send it
    straight back here, forever. A refresh that reports success without leaving a token
    behind is a bug somewhere else; here it is simply not a session.
  */
  const token = await readAccessToken();
  if (!token) return NextResponse.redirect(loginUrl);

  return NextResponse.redirect(new URL(next ?? `/${locale}`, request.url));
}
