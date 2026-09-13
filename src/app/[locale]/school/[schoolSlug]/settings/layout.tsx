import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getMySchoolRole } from '@/features/school/api/get-my-school-role';
import { SettingsLayout } from '@/components/shared/settings-layout';
import { wsHref } from '@/features/workspaces/lib/href';

type Props = {
  children: React.ReactNode;
  params: Promise<{ schoolSlug: string }>;
};

export default async function SchoolSettingsLayout({ children, params }: Props) {
  const { schoolSlug } = await params;

  const role = await getMySchoolRole(schoolSlug);
  if (!role || !['OWNER', 'ADMIN'].includes(role)) {
    notFound();
  }

  const t = await getTranslations('Settings');

  const nav = [
    { href: wsHref(schoolSlug, 'settings/profile'), label: t('nav.profile') },
    { href: wsHref(schoolSlug, 'settings/account'), label: t('nav.account') },
    { href: wsHref(schoolSlug, 'settings/notifications'), label: t('nav.notifications') },
    { href: wsHref(schoolSlug, 'settings/review'), label: t('nav.review') },
  ];

  return <SettingsLayout nav={nav}>{children}</SettingsLayout>;
}
