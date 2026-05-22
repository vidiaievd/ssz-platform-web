import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

export default async function SchoolSettingsPage() {
  const locale = await getLocale();
  redirect(`/${locale}/school/settings/profile`);
}
