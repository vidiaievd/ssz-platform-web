import createMiddleware from 'next-intl/middleware';

import { routing } from '@/lib/i18n/routing';

export function proxy() {
  return createMiddleware(routing);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
