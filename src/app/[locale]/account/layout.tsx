import { getTranslations } from 'next-intl/server';

import { SettingsLayout } from '@/components/shared/settings-layout';

type Props = { children: React.ReactNode };

export default async function AccountLayout({ children }: Props) {
  const t = await getTranslations('Account');

  const nav = [
    { href: '/account/profile', label: t('nav.profile') },
    { href: '/account/appearance', label: t('nav.appearance') },
    { href: '/account/notifications', label: t('nav.notifications') },
    { href: '/account/security', label: t('nav.security') },
  ];

  return <SettingsLayout nav={nav}>{children}</SettingsLayout>;
}
