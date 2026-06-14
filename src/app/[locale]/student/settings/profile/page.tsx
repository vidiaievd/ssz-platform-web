import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

export default async function StudentProfileSettingsPage() {
  const locale = await getLocale();
  redirect(`/${locale}/account/profile`);
}
