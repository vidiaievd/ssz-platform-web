import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';

import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { GLOBAL_NAMESPACES, INVITE_NAMESPACES } from '@/lib/i18n/messages';
import { pickMessages } from '@/lib/i18n/pick-messages';

export default async function InviteLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages, t] = await Promise.all([
    getLocale(),
    getMessages(),
    getTranslations('Common'),
  ]);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={pickMessages(messages, [...GLOBAL_NAMESPACES, ...INVITE_NAMESPACES])}
    >
      <div className="flex min-h-screen flex-col bg-(--ssz-bg-base)">
        <header className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-(--ssz-text-primary)">
            {t('appName')}
          </span>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>
    </NextIntlClientProvider>
  );
}
