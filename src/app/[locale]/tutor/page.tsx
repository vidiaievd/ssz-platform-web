import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { requireAnyRole } from '@/lib/auth/protect';
import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { getTutorProfile } from '@/features/profile/api/get-tutor-profile';
import { generateSlug } from '@/lib/utils/slug';

export default async function TutorIndexPage() {
  await requireAnyRole(['tutor']);

  const [locale, profile, tutorProfile] = await Promise.all([
    getLocale(),
    getMyProfile(),
    getTutorProfile(),
  ]);

  if (!tutorProfile) {
    redirect(`/${locale}/onboarding?step=prefs`);
  }

  const slug = generateSlug(profile?.displayName ?? '');
  if (!slug) {
    redirect(`/${locale}/onboarding?step=profile`);
  }

  redirect(`/${locale}/tutor/${slug}/dashboard`);
}
