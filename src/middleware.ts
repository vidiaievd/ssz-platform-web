import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';

import { LOCALES } from '@/lib/i18n/config';
import { routing } from '@/lib/i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Matches /{locale}/school or /{locale}/student and any sub-path
const localePattern = LOCALES.join('|');
const PROTECTED_RE = new RegExp(`^/(${localePattern})/(school|student)(/.*)?$`);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PROTECTED_RE.test(pathname)) {
    const hasToken = request.cookies.has('ssz_at');
    if (!hasToken) {
      const locale = pathname.split('/')[1];
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
};
