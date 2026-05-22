import { getTranslations } from 'next-intl/server';

import { SettingsLayout } from '@/components/shared/settings-layout';

export default async function StudentSettingsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('Settings');
  const nav = [
    { href: '/student/settings/profile', label: t('nav.profile') },
    { href: '/student/settings/account', label: t('nav.account') },
    { href: '/student/settings/notifications', label: t('nav.notifications') },
  ];

  return <SettingsLayout nav={nav}>{children}</SettingsLayout>;
}
