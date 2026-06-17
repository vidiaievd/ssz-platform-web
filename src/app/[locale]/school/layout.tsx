import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { requireUser } from '@/lib/auth/protect';
import { getTutorProfile } from '@/features/profile/api/get-tutor-profile';

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const locale = await getLocale();

  if (user.roles.includes('tutor')) {
    const tutorProfile = await getTutorProfile();
    if (!tutorProfile) redirect(`/${locale}/onboarding`);
  }

  return <>{children}</>;
}
