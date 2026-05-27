import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { requireAnyRole } from '@/lib/auth/protect';
import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { CreateSchoolWizard } from '@/features/school/components/create/wizard';

export default async function CreateSchoolPage() {
  const user = await requireAnyRole(['tutor', 'school_admin']);
  const locale = await getLocale();
  const profile = await getMyProfile().catch(() => null);

  if (!user.roles.includes('tutor') && !user.roles.includes('school_admin')) {
    redirect(`/${locale}/student/enrolled`);
  }

  return <CreateSchoolWizard tutorEmail={profile?.contactEmail ?? undefined} />;
}
