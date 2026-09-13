import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getMySchoolRole } from '@/features/school/api/get-my-school-role';
import { SettingsLayout } from '@/components/shared/settings-layout';
import { wsHref } from '@/features/workspaces/lib/href';

type Props = {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
};

export default async function SchoolSettingsLayout({ children, params }: Props) {
  const { workspaceId } = await params;

  const role = await getMySchoolRole(workspaceId);
  if (!role || !['OWNER', 'ADMIN'].includes(role)) {
    notFound();
  }

  const t = await getTranslations('Settings');

  const nav = [
    { href: wsHref(workspaceId, 'settings/profile'), label: t('nav.profile') },
    { href: wsHref(workspaceId, 'settings/account'), label: t('nav.account') },
    { href: wsHref(workspaceId, 'settings/notifications'), label: t('nav.notifications') },
    { href: wsHref(workspaceId, 'settings/review'), label: t('nav.review') },
  ];

  return <SettingsLayout nav={nav}>{children}</SettingsLayout>;
}
