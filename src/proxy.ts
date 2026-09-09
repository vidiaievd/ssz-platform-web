import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';

import { LOCALES } from '@/lib/i18n/config';
import { routing } from '@/lib/i18n/routing';

const intlMiddleware = createMiddleware(routing);

const localePattern = LOCALES.join('|');
const PROTECTED_RE = new RegExp(`^/(${localePattern})/(school|student)(/.*)?$`);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
};
