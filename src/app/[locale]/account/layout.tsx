import { getTranslations } from 'next-intl/server';

import { SettingsLayout } from '@/components/shared/settings-layout';
import { AccountBackButton } from '@/features/account';

type Props = { children: React.ReactNode };

export default async function AccountLayout({ children }: Props) {
  const t = await getTranslations('Account');

  const nav = [
    { href: '/account/profile', label: t('nav.profile') },
    { href: '/account/appearance', label: t('nav.appearance') },
    { href: '/account/notifications', label: t('nav.notifications') },
    { href: '/account/security', label: t('nav.security') },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <div className="border-b border-border px-3 py-2">
        <AccountBackButton />
      </div>
      <div className="flex-1 min-h-0">
        <SettingsLayout nav={nav}>{children}</SettingsLayout>
      </div>
    </div>
  );
}
