import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';

import { SettingsLayout } from '@/components/shared/settings-layout';
import { AccountBackButton, UnsavedChangesProvider } from '@/features/account';
import { NOTIFICATIONS_ENABLED } from '@/lib/config/feature-flags';
import { ACCOUNT_NAMESPACES, GLOBAL_NAMESPACES } from '@/lib/i18n/messages';
import { pickMessages } from '@/lib/i18n/pick-messages';

type Props = { children: React.ReactNode };

export default async function AccountLayout({ children }: Props) {
  const [locale, messages, t] = await Promise.all([
    getLocale(),
    getMessages(),
    getTranslations('Account'),
  ]);

  const nav = [
    { href: '/account/profile', label: t('nav.profile'), icon: 'UserRound' as const },
    { href: '/account/security', label: t('nav.security'), icon: 'ShieldCheck' as const },
    ...(NOTIFICATIONS_ENABLED
      ? [{ href: '/account/notifications', label: t('nav.notifications'), icon: 'Bell' as const }]
      : []),
  ];

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={pickMessages(messages, [...GLOBAL_NAMESPACES, ...ACCOUNT_NAMESPACES])}
    >
      <UnsavedChangesProvider>
        <div className="h-dvh flex flex-col">
          <div className="shrink-0 border-b border-border px-3 py-2">
            <AccountBackButton />
          </div>
          <div className="flex-1 min-h-0">
            <SettingsLayout nav={nav}>{children}</SettingsLayout>
          </div>
        </div>
      </UnsavedChangesProvider>
    </NextIntlClientProvider>
  );
}
