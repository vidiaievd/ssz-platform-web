import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { requireAnyRole } from '@/lib/auth/protect';
import { getTutorProfile } from '@/features/profile/api/get-tutor-profile';

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAnyRole(['tutor', 'school_admin', 'teacher']);
  const locale = await getLocale();

  if (user.roles.includes('tutor')) {
    const tutorProfile = await getTutorProfile();
    if (!tutorProfile) redirect(`/${locale}/onboarding`);
  }

  return <>{children}</>;
}
