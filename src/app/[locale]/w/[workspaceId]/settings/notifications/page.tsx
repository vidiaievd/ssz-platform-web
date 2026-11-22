import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { requireSettingsPage } from '@/features/workspaces/api/require-settings-page';

type Props = { params: Promise<{ workspaceId: string }> };

/** Notifications are set per person, under /account (as the profile is). */
export default async function SchoolNotificationsSettingsPage({ params }: Props) {
  const { workspaceId } = await params;
  await requireSettingsPage(workspaceId, 'notifications');
  const locale = await getLocale();
  redirect(`/${locale}/account/notifications`);
}
