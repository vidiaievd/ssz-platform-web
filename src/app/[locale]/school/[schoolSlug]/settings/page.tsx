import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

type Props = { params: Promise<{ schoolSlug: string }> };

export default async function SchoolSettingsPage({ params }: Props) {
  const { schoolSlug } = await params;
  const locale = await getLocale();
  redirect(`/${locale}/school/${schoolSlug}/settings/profile`);
}
