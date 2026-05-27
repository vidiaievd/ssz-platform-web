import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

type Props = { params: Promise<{ schoolId: string }> };

export default async function SchoolSettingsPage({ params }: Props) {
  const { schoolId } = await params;
  const locale = await getLocale();
  redirect(`/${locale}/school/${schoolId}/settings/profile`);
}
