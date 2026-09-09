import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { requireAnyRole } from '@/lib/auth/protect';
import { getTutorProfile } from '@/features/profile/api/get-tutor-profile';

export default async function TutorIndexPage() {
  const user = await requireAnyRole(['tutor']);

  const [locale, tutorProfile] = await Promise.all([getLocale(), getTutorProfile()]);

  if (!tutorProfile) {
    redirect(`/${locale}/onboarding`);
  }

  // Use stable userId from JWT, not a generated name-based slug
  const userId = user.userId;
  if (!userId) {
    redirect(`/${locale}/onboarding`);
  }

  redirect(`/${locale}/tutor/${userId}/dashboard`);
}
