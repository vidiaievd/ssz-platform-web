import { getTranslations } from 'next-intl/server';

import { SettingsLayout } from '@/components/shared/settings-layout';
import { AccountBackButton, UnsavedChangesProvider } from '@/features/account';
import { NOTIFICATIONS_ENABLED } from '@/lib/config/feature-flags';

type Props = { children: React.ReactNode };

export default async function AccountLayout({ children }: Props) {
  const t = await getTranslations('Account');

  const nav = [
    { href: '/account/profile', label: t('nav.profile'), icon: 'UserRound' as const },
    { href: '/account/security', label: t('nav.security'), icon: 'ShieldCheck' as const },
    ...(NOTIFICATIONS_ENABLED
      ? [{ href: '/account/notifications', label: t('nav.notifications'), icon: 'Bell' as const }]
      : []),
  ];

  return (
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
  );
}
