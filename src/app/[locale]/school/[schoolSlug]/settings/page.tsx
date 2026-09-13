import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { wsHref } from '@/features/workspaces/lib/href';

type Props = { params: Promise<{ schoolSlug: string }> };

export default async function SchoolSettingsPage({ params }: Props) {
  const { schoolSlug } = await params;
  const locale = await getLocale();
  redirect(`/${locale}${wsHref(schoolSlug, 'settings/profile')}`);
}
