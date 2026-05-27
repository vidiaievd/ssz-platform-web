import { getTranslations } from 'next-intl/server';

import { SettingsLayout } from '@/components/shared/settings-layout';

type Props = {
  children: React.ReactNode;
  params: Promise<{ schoolId: string }>;
};

export default async function SchoolSettingsLayout({ children, params }: Props) {
  const { schoolId } = await params;
  const t = await getTranslations('Settings');

  const nav = [
    { href: `/school/${schoolId}/settings/profile`, label: t('nav.profile') },
    { href: `/school/${schoolId}/settings/account`, label: t('nav.account') },
    { href: `/school/${schoolId}/settings/notifications`, label: t('nav.notifications') },
  ];

  return <SettingsLayout nav={nav}>{children}</SettingsLayout>;
}
