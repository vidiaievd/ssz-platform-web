import { getTranslations } from 'next-intl/server';

import { SettingsLayout } from '@/components/shared/settings-layout';

export default async function SchoolSettingsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('Settings');
  const nav = [
    { href: '/school/settings/profile', label: t('nav.profile') },
    { href: '/school/settings/account', label: t('nav.account') },
    { href: '/school/settings/notifications', label: t('nav.notifications') },
  ];

  return <SettingsLayout nav={nav}>{children}</SettingsLayout>;
}
