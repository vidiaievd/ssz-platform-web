import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { requireSettingsPage } from '@/features/workspaces/api/require-settings-page';

type Props = { params: Promise<{ workspaceId: string }> };

/** The account is the person's, not the workspace's: it lives under /account (as the profile does). */
export default async function SchoolAccountSettingsPage({ params }: Props) {
  const { workspaceId } = await params;
  await requireSettingsPage(workspaceId, 'account');
  const locale = await getLocale();
  redirect(`/${locale}/account`);
}
