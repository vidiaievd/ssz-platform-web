import type { Metadata } from 'next';

import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n/config';

/**
 * The public origin of the web app. Search engines need absolute URLs (sitemap, robots,
 * canonical links resolve against `metadataBase`), so this is the one place that decides it.
 */
export function siteUrl(): URL {
  return new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
}

/** `/en` + `/discover` → `/en/discover`; the home page is `/en`, not `/en/`. */
export function localePath(locale: Locale, path: string): string {
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

/** Every translation of one page, keyed the way `hreflang` expects; `x-default` is the default locale. */
export function languageAlternates(path: string, absolute = false): Record<string, string> {
  const base = absolute ? siteUrl().origin : '';
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) languages[locale] = base + localePath(locale, path);
  languages['x-default'] = base + localePath(DEFAULT_LOCALE, path);
  return languages;
}

/**
 * Canonical link and `hreflang` alternates for a public page. `path` is the route without the
 * locale prefix and without query parameters — a filtered or paged list is the same page.
 */
export function localeAlternates(locale: Locale, path: string): Metadata['alternates'] {
  return {
    canonical: localePath(locale, path),
    languages: languageAlternates(path),
  };
}
