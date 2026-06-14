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
      const locale = pathname.split('/')[1]!;
      const loginUrl = new URL(`/${locale}/login`, request.url);
      const pathWithoutLocale = pathname.slice(locale.length + 1) || '/';
      loginUrl.searchParams.set('redirect', pathWithoutLocale);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
};
