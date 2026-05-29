import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { getMySchools } from '@/features/school/api/get-my-schools';
import { getCurrentUser } from '@/features/auth/api/get-current-user';

export default async function SchoolIndexPage() {
  const [locale, schools, user] = await Promise.all([
    getLocale(),
    getMySchools(),
    getCurrentUser(),
  ]);

  if (schools.length > 0) {
    const first = schools[0]!;
    redirect(`/${locale}/school/${first.slug ?? first.id}/dashboard`);
  }

  if (user?.roles.includes('school_admin')) {
    redirect(`/${locale}/onboarding/school`);
  }

  // Private tutors get their own workspace, not the school workspace.
  // Checked before student because tutors always carry the student role too.
  if (user?.roles.includes('tutor')) {
    redirect(`/${locale}/tutor`);
  }

  redirect(`/${locale}/student/dashboard`);
}
