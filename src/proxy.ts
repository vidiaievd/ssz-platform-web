import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';

import { acceptCorrelationId, CORRELATION_HEADER } from '@/lib/api/bff-log';
import { LOCALES } from '@/lib/i18n/config';
import { routing } from '@/lib/i18n/routing';

const intlMiddleware = createMiddleware(routing);

const localePattern = LOCALES.join('|');
const PROTECTED_RE = new RegExp(`^/(${localePattern})/(school|student)(/.*)?$`);

/**
 * One id per incoming request, for the BFF's log and every upstream call it makes (OQ-43).
 * An id that came in (a proxy in front of us) is kept when it is well-formed; otherwise a
 * new one is made. It is written into the request's own headers — next-intl copies those
 * into the request it passes on — and echoed on the response.
 */
function stampCorrelationId(request: NextRequest): string {
  const id = acceptCorrelationId(request.headers.get(CORRELATION_HEADER)) ?? crypto.randomUUID();
  request.headers.set(CORRELATION_HEADER, id);
  return id;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const correlationId = stampCorrelationId(request);

  // The BFF's route handlers: no locale and no login redirect, only the id passed on.
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next({ request: { headers: request.headers } });
    response.headers.set(CORRELATION_HEADER, correlationId);
    return response;
  }

  if (PROTECTED_RE.test(pathname)) {
    const hasToken = request.cookies.has('ssz_at');
    if (!hasToken) {
      /*
        A missing access cookie is not the same thing as a signed-out visitor. The cookie
        expires with the token inside it — fifteen minutes — while the refresh token is
        good for days, so most of these are sessions that simply need renewing.

        The renewal is not done here. This function runs on every request, in isolates
        that share nothing, so a page that fans out ten requests would fan out ten
        rotations of one refresh token, and auth-service answers the second presentation
        of a rotated token by revoking every session the user has. A navigation, though,
        is a single request — so it is handed to a Route Handler, which may write cookies
        and which holds a single-flight lock. Anything else (a data request, an API call)
        goes on as before and refreshes through the BFF on its own 401.
      */
      const locale = pathname.split('/')[1]!;
      const pathWithoutLocale = pathname.slice(locale.length + 1) || '/';

      if (request.cookies.has('ssz_rt')) {
        const renewUrl = new URL('/api/auth/session/refresh', request.url);
        renewUrl.searchParams.set('next', pathname + request.nextUrl.search);
        return NextResponse.redirect(renewUrl);
      }

      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set('redirect', pathWithoutLocale);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = intlMiddleware(request);
  response.headers.set(CORRELATION_HEADER, correlationId);
  return response;
}

export const config = {
  // robots.txt and sitemap.xml live at the root — the locale middleware would redirect them to /en/….
  // /api is matched only to stamp the correlation id (see the early return above).
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)'],
};
