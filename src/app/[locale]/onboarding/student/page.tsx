/**
 * Onboard-existing branch: logged-in user without student role accepts an
 * invitation link that grants role `student` + student profile + school+group.
 * URL: /onboarding/student?token=<invitationToken>
 */
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';

import { requireVerifiedUser } from '@/lib/auth/protect';
import { getStudentProfile } from '@/features/profile/api/get-student-profile';
import { OnboardingShell } from '@/features/profile/components/onboarding/shell';
import { getMyProfile } from '@/features/profile/api/get-my-profile';

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function OnboardStudentPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const [user, locale, t] = await Promise.all([
    requireVerifiedUser(),
    getLocale(),
    getTranslations('Students'),
  ]);

  // If already a student with a profile, accept token and redirect
  const existingProfile = await getStudentProfile();
  if (existingProfile && token) {
    await fetch(`/api/schools/invitations/${token}/accept`, { method: 'POST' });
    redirect(`/${locale}/student/dashboard`);
  }

  if (existingProfile) {
    redirect(`/${locale}/student/dashboard`);
  }

  const profile = await getMyProfile();
  const detectedTimezone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';

  return (
    <div className="space-y-4">
      {token && (
        <div className="rounded-lg border bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
          {t('onboard.invitationBanner')}
        </div>
      )}
      {/* invitationToken acceptance is handled server-side in the onboarding completion action */}
      <OnboardingShell
        role="student"
        initialProfileValues={{
          displayName: profile?.displayName ?? '',
          timezone: profile?.timezone || detectedTimezone,
          uiLocale: (profile?.uiLocale as 'en' | 'nb' | 'uk' | 'ru') ?? (locale as 'en' | 'nb' | 'uk' | 'ru') ?? 'en',
        }}
      />
    </div>
  );
}
