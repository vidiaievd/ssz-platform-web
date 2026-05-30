import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { requireUser } from '@/lib/auth/protect';
import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { getStudentProfile } from '@/features/profile/api/get-student-profile';
import { getTutorProfile } from '@/features/profile/api/get-tutor-profile';
import { OnboardingShell } from '@/features/profile/components/onboarding/shell';
import type { OnboardingRole } from '@/features/profile/stores/onboarding-store';

export default async function OnboardingPage() {
  const [user, locale] = await Promise.all([requireUser(), getLocale()]);
  const role: OnboardingRole = user.roles.includes('tutor') ? 'tutor' : 'student';

  // Step navigation is client-side (no URL changes), so the server component renders once.
  // Fetch base profile (for form pre-fill) and sub-profile (guard) in parallel.
  const [profile, existingSubProfile] = await Promise.all([
    getMyProfile(),
    role === 'student' ? getStudentProfile() : getTutorProfile(),
  ]);

  if (existingSubProfile) {
    redirect(role === 'tutor' ? `/${locale}/school` : `/${locale}/student/dashboard`);
  }

  const detectedTimezone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';

  return (
    <OnboardingShell
      role={role}
      initialProfileValues={{
        displayName: profile?.displayName ?? '',
        firstName: undefined,
        lastName: undefined,
        timezone: profile?.timezone || detectedTimezone,
        uiLocale: (profile?.uiLocale as 'en' | 'nb' | 'uk' | 'ru') ?? (locale as 'en' | 'nb' | 'uk' | 'ru') ?? 'en',
        bio: profile?.bio ?? undefined,
      }}
    />
  );
}
