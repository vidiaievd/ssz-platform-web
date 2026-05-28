import { getTranslations } from 'next-intl/server';

import { SettingsLayout } from '@/components/shared/settings-layout';

type Props = {
  children: React.ReactNode;
  params: Promise<{ schoolSlug: string }>;
};

export default async function SchoolSettingsLayout({ children, params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations('Settings');

  const nav = [
    { href: `/school/${schoolSlug}/settings/profile`, label: t('nav.profile') },
    { href: `/school/${schoolSlug}/settings/account`, label: t('nav.account') },
    { href: `/school/${schoolSlug}/settings/notifications`, label: t('nav.notifications') },
  ];

  return <SettingsLayout nav={nav}>{children}</SettingsLayout>;
}
