import { requireAnyRole, requireVerifiedUser } from '@/lib/auth/protect';
import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { CreateSchoolWizard } from '@/features/school/components/create/wizard';

export default async function OnboardingSchoolPage() {
  await requireVerifiedUser();
  await requireAnyRole(['tutor', 'school_admin']);

  let profile: Awaited<ReturnType<typeof getMyProfile>> | null = null;
  let profileError = false;
  try {
    profile = await getMyProfile();
  } catch (err) {
    console.error('[onboarding/school] getMyProfile failed:', err);
    profileError = true;
  }

  return (
    <>
      {profileError && (
        <p className="px-4 pt-4 text-sm text-destructive">
          Failed to load your profile. Your email won&apos;t be pre-filled.
        </p>
      )}
      <CreateSchoolWizard tutorEmail={profile?.contactEmail ?? undefined} />
    </>
  );
}
