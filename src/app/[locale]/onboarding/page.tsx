import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { requireUser } from '@/lib/auth/protect';
import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { getStudentProfile } from '@/features/profile/api/get-student-profile';
import { getTutorProfile } from '@/features/profile/api/get-tutor-profile';
import { OnboardingShell } from '@/features/profile/components/onboarding/shell';
import type { OnboardingRole } from '@/features/profile/stores/onboarding-store';

export default async function OnboardingPage() {
  const user = await requireUser();
  const locale = await getLocale();

  const profile = await getMyProfile();
  const role: OnboardingRole = user.roles.includes('tutor') ? 'tutor' : 'student';

  // Guard: redirect users who have already completed onboarding.
  // We check only the sub-profile relevant to the user's role — hasStudentProfile /
  // hasTutorProfile flags reflect the assigned role, not whether a sub-profile exists.
  if (role === 'tutor') {
    const tutorProfile = await getTutorProfile();
    if (tutorProfile) redirect(`/${locale}/school`);
  } else {
    const studentProfile = await getStudentProfile();
    if (studentProfile) redirect(`/${locale}/student/dashboard`);
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
