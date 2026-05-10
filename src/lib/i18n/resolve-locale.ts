import { DEFAULT_LOCALE, LOCALES, type Locale } from './config';

type ResolveInput = {
  /** Cookie value if set. */
  cookie?: string;
  /** Raw `Accept-Language` header. */
  acceptLanguage?: string;
  /** ISO 3166-1 alpha-2 country code from geo-IP, if available. */
  country?: string;
};

/**
 * Resolution order:
 * 1. Cookie (explicit user choice) wins, if it is a supported locale.
 * 2. Country-based override:
 *    - Norway (NO) → nb
 *    - Ukraine (UA) → uk, even if Accept-Language is ru.
 *      Many Ukrainians have legacy `ru` in their browser settings;
 *      offer Ukrainian by default and let them switch explicitly.
 * 3. First matching locale from Accept-Language.
 * 4. DEFAULT_LOCALE.
 */
export function resolveLocale(input: ResolveInput): Locale {
  const supported = new Set<Locale>(LOCALES);

  if (input.cookie && supported.has(input.cookie as Locale)) {
    return input.cookie as Locale;
  }

  const country = input.country?.toUpperCase();
  if (country === 'NO') return 'nb';
  if (country === 'UA') return 'uk';

  if (input.acceptLanguage) {
    const requested = parseAcceptLanguage(input.acceptLanguage);
    for (const tag of requested) {
      const base = tag.split('-')[0]?.toLowerCase() as Locale | undefined;
      if (base && supported.has(base)) return base;
    }
  }

  return DEFAULT_LOCALE;
}

function parseAcceptLanguage(header: string): string[] {
  return header
    .split(',')
    .map((part) => {
      const [tag, q = 'q=1'] = part.trim().split(';');
      const quality = Number.parseFloat(q.replace('q=', '')) || 0;
      return { tag: tag?.trim() ?? '', quality };
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.quality - a.quality)
    .map((x) => x.tag);
}
