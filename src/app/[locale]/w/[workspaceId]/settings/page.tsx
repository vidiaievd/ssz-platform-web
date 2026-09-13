import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { wsHref } from '@/features/workspaces/lib/href';

type Props = { params: Promise<{ workspaceId: string }> };

export default async function SchoolSettingsPage({ params }: Props) {
  const { workspaceId } = await params;
  const locale = await getLocale();
  redirect(`/${locale}${wsHref(workspaceId, 'settings/profile')}`);
}
