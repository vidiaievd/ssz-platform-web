import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { requireUser } from '@/lib/auth/protect';
import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { getStudentProfile } from '@/features/profile/api/get-student-profile';
import { getTutorProfile } from '@/features/profile/api/get-tutor-profile';
import { OnboardingWizard } from '@/features/profile/components/onboarding-wizard';

export default async function OnboardingPage() {
  const user = await requireUser();
  const locale = await getLocale();

  const isTutorOrSchool = user.roles.some((r) => r === 'tutor' || r === 'school');
  const role: 'student' | 'tutor' = isTutorOrSchool ? 'tutor' : 'student';

  // Already onboarded — skip to dashboard.
  if (role === 'student') {
    const studentProfile = await getStudentProfile();
    if (studentProfile) redirect(`/${locale}/student/dashboard`);
  } else {
    const tutorProfile = await getTutorProfile();
    if (tutorProfile) redirect(`/${locale}/school/dashboard`);
  }

  const profile = await getMyProfile();

  return (
    <OnboardingWizard
      role={role}
      initialDisplayName={profile?.displayName ?? ''}
      initialLocale={profile?.uiLocale ?? 'en'}
      initialTimezone={profile?.timezone ?? 'UTC'}
    />
  );
}
