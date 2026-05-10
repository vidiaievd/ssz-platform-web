export const LOCALES = ['en', 'nb', 'uk', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Endonyms shown in the language switcher.
 * No flags, no region: locales are language identifiers, not state identifiers.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  nb: 'Norsk',
  uk: 'Українська',
  ru: 'Русский',
};

/** BCP 47 codes used by Intl APIs. */
export const LOCALE_BCP47: Record<Locale, string> = {
  en: 'en',
  nb: 'nb',
  uk: 'uk',
  ru: 'ru',
};

export const LOCALE_COOKIE = 'NEXT_LOCALE';
