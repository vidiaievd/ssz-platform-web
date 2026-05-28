import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { getMySchools } from '@/features/school/api/get-my-schools';

/**
 * Entry point for the school workspace.
 * Redirects to the first school's dashboard, or to onboarding if none exist.
 */
export default async function SchoolIndexPage() {
  const locale = await getLocale();
  const schools = await getMySchools();

  if (schools.length > 0) {
    const first = schools[0]!;
    redirect(`/${locale}/school/${first.slug ?? first.id}/dashboard`);
  }

  redirect(`/${locale}/onboarding/school`);
}
