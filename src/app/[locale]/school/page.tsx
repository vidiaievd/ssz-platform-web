import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { getMySchools } from '@/features/school/api/get-my-schools';
import type { School } from '@/features/school/types';
import { getCurrentUser } from '@/features/auth/api/get-current-user';

type SchoolsResult = { ok: true; schools: School[] } | { ok: false };

export default async function SchoolIndexPage() {
  const [locale, schoolsResult, user] = await Promise.all([
    getLocale(),
    getMySchools()
      .then((schools): SchoolsResult => ({ ok: true, schools }))
      .catch((): SchoolsResult => ({ ok: false })),
    getCurrentUser(),
  ]);

  if (schoolsResult.ok && schoolsResult.schools.length > 0) {
    const first = schoolsResult.schools[0]!;
    redirect(`/${locale}/school/${first.slug ?? first.id}/dashboard`);
  }

  if (user?.roles.includes('school_admin')) {
    // Only send to onboarding when we know the list is genuinely empty.
    // A fetch failure (502/network) must not trigger onboarding — the school likely exists.
    if (!schoolsResult.ok) {
      return (
        <main className="flex min-h-[60vh] items-center justify-center p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Unable to load your schools. Please refresh or try again later.
          </p>
        </main>
      );
    }
    redirect(`/${locale}/onboarding/school`);
  }

  // Private tutors get their own workspace, not the school workspace.
  // Checked before student because tutors always carry the student role too.
  if (user?.roles.includes('tutor')) {
    redirect(`/${locale}/tutor`);
  }

  redirect(`/${locale}/student/dashboard`);
}
