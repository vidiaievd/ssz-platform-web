import { requireAnyRole } from '@/lib/auth/protect';
import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { CreateSchoolWizard } from '@/features/school/components/create/wizard';

export default async function OnboardingSchoolPage() {
  await requireAnyRole(['tutor', 'school_admin']);
  const profile = await getMyProfile().catch(() => null);

  return <CreateSchoolWizard tutorEmail={profile?.contactEmail ?? undefined} />;
}
