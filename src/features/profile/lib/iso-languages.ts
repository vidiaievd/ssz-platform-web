/**
 * Common ISO 639-1 language codes for the onboarding language combobox.
 * Names are rendered at runtime via Intl.DisplayNames for correct endonyms.
 */
export const ISO_LANGUAGE_CODES = [
  'af', 'ar', 'az', 'be', 'bg', 'bn', 'bs', 'ca', 'cs', 'cy',
  'da', 'de', 'el', 'en', 'es', 'et', 'eu', 'fa', 'fi', 'fil',
  'fr', 'ga', 'gl', 'gu', 'he', 'hi', 'hr', 'hu', 'hy', 'id',
  'is', 'it', 'ja', 'ka', 'kk', 'km', 'kn', 'ko', 'lt', 'lv',
  'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my', 'nb', 'nl', 'nn',
  'pa', 'pl', 'pt', 'ro', 'ru', 'si', 'sk', 'sl', 'sq', 'sr',
  'sv', 'sw', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'uz', 'vi',
  'zh', 'zu',
] as const;

export type ISOLanguageCode = (typeof ISO_LANGUAGE_CODES)[number];

/** Returns the language's endonym (self-name) via Intl.DisplayNames. Falls back to code. */
export function getEndonym(code: string): string {
  try {
    return new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Returns the English display name of a language code. Falls back to code. */
export function getEnglishName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export type LanguageOption = { code: string; endonym: string; english: string };

/** Builds the sorted language option list, optionally excluding certain codes. */
export function buildLanguageOptions(exclude: string[] = []): LanguageOption[] {
  return ISO_LANGUAGE_CODES.filter((c) => !exclude.includes(c))
    .map((code) => ({ code, endonym: getEndonym(code), english: getEnglishName(code) }))
    .sort((a, b) => a.endonym.localeCompare(b.endonym));
}
