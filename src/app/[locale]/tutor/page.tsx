import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { requireAnyRole } from '@/lib/auth/protect';
import { getTutorProfile } from '@/features/profile/api/get-tutor-profile';
import { getTutorWorkspace } from '@/features/tutoring/api/get-tutor-workspace';
import { wsHref } from '@/features/workspaces/lib/href';

export default async function TutorIndexPage() {
  await requireAnyRole(['tutor']);

  const [locale, tutorProfile] = await Promise.all([getLocale(), getTutorProfile()]);

  if (!tutorProfile) {
    redirect(`/${locale}/onboarding`);
  }

  // A tutor's screens are their workspace's screens now, so this lands where a school
  // admin lands: inside the workspace, on its dashboard. The server provisions one for a
  // tutor who registered before workspaces existed, so a miss here is a real failure.
  const workspace = await getTutorWorkspace();
  if (!workspace) {
    redirect(`/${locale}/onboarding`);
  }

  redirect(`/${locale}${wsHref(workspace.schoolId, 'dashboard')}`);
}
