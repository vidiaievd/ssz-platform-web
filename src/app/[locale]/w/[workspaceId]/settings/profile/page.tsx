import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { requireSettingsPage } from '@/features/workspaces/api/require-settings-page';

type Props = { params: Promise<{ workspaceId: string }> };

export default async function SchoolProfileSettingsPage({ params }: Props) {
  const { workspaceId } = await params;
  await requireSettingsPage(workspaceId, 'profile');
  const locale = await getLocale();
  redirect(`/${locale}/account/profile`);
}
