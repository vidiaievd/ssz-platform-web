'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { cn } from '@/lib/utils';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/config';
import { usePathname, useRouter } from '@/lib/i18n/navigation';

const THEME_OPTIONS = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
] as const;

export function AppearanceScreen() {
  const t = useTranslations('Account.appearance');
  const tTheme = useTranslations('Theme');
  const { theme, setTheme } = useTheme();

  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const switchLocale = (next: Locale) => {
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <div className="p-6 md:p-8 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-(--ssz-text-muted) mt-1">{t('subtitle')}</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">{t('theme')}</h2>
        <div className="flex flex-wrap gap-3">
          {THEME_OPTIONS.map(({ value, icon: Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                aria-pressed={active}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border-2 px-6 py-4 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-(--ssz-text-muted) hover:border-primary/50 hover:text-(--ssz-text-primary)',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {tTheme(value)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">{t('language')}</h2>
        <div className="flex flex-wrap gap-3">
          {LOCALES.map((l) => {
            const active = l === locale;
            return (
              <button
                key={l}
                onClick={() => switchLocale(l)}
                disabled={isPending}
                aria-pressed={active}
                className={cn(
                  'rounded-lg border-2 px-5 py-3 text-sm font-medium transition-colors disabled:opacity-50',
                  active
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-(--ssz-text-muted) hover:border-primary/50 hover:text-(--ssz-text-primary)',
                )}
              >
                {LOCALE_LABELS[l]}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
