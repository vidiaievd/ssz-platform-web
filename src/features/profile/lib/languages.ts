/**
 * Curated list of languages used for student target languages and tutor teaching languages.
 * BCP 47 codes (language-only, no region).
 */
export const TEACHING_LANGUAGES = [
  { code: 'nb', label: 'Norwegian (Bokmål)' },
  { code: 'nn', label: 'Norwegian (Nynorsk)' },
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'ru', label: 'Russian' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pl', label: 'Polish' },
  { code: 'nl', label: 'Dutch' },
  { code: 'sv', label: 'Swedish' },
  { code: 'da', label: 'Danish' },
  { code: 'fi', label: 'Finnish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese (Mandarin)' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
  { code: 'tr', label: 'Turkish' },
] as const;

export type TeachingLanguageCode = (typeof TEACHING_LANGUAGES)[number]['code'];

export function getLanguageLabel(code: string): string {
  return TEACHING_LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
}
