import { cn } from '@/lib/utils';
import type { LangCode } from '@/features/teachers/types';

// Endonyms — no flags (CLAUDE.md i18n rule)
const ENDONYMS: Record<string, string> = {
  en: 'English',
  nb: 'Norsk',
  uk: 'Українська',
  ru: 'Русский',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  pl: 'Polski',
  nl: 'Nederlands',
  pt: 'Português',
  sv: 'Svenska',
  da: 'Dansk',
  fi: 'Suomi',
  tr: 'Türkçe',
  ar: 'العربية',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
};

type LanguageChipProps = {
  lang: LangCode;
  className?: string;
};

export function LanguageChip({ lang, className }: LanguageChipProps) {
  const label = ENDONYMS[lang] ?? lang.toUpperCase();
  return (
    <span
      lang={lang}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5',
        'text-[11px] font-medium',
        'bg-primary/10 text-primary dark:bg-primary/20',
        className,
      )}
    >
      {label}
    </span>
  );
}
