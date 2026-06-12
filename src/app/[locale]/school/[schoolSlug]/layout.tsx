import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { requireAnyRole } from '@/lib/auth/protect';
import { getQueryClient } from '@/lib/query/client';
import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { profileKeys } from '@/features/profile/api/keys';
import { getMySchools } from '@/features/school/api/get-my-schools';
import { getSchool } from '@/features/school/api/get-school';
import { schoolKeys } from '@/features/school/api/keys';
import { deriveSchoolType } from '@/features/dashboard/lib/derive';
import { AppShell } from '@/components/shared/app-shell';
import { WorkspaceActivator } from '@/features/workspaces/components/workspace-activator';
import type { SchoolContext } from '@/components/shared/app-shell';
import type { DashboardRole } from '@/features/dashboard/types';
import type { SchoolRole } from '@/features/school/types';

type Props = {
  children: React.ReactNode;
  params: Promise<{ schoolSlug: string }>;
};

const SCHOOL_ROLE_TO_DASHBOARD: Record<SchoolRole, DashboardRole> = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'admin',
  TEACHER: 'teacher',
  CONTENT_ADMIN: 'editor',
  SCHEDULER: 'teacher',
  STUDENT: 'teacher',
};

export default async function SchoolInstanceLayout({ children, params }: Props) {
  const { schoolSlug } = await params;
  const user = await requireAnyRole(['tutor', 'school_admin', 'teacher', 'student']);
  const locale = await getLocale();

  const queryClient = getQueryClient();
  const [schools] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: schoolKeys.mine(),
      queryFn: getMySchools,
    }),
    queryClient.prefetchQuery({
      queryKey: profileKeys.me(),
      queryFn: getMyProfile,
    }),
  ]);

  let school = schools.find((s) => s.slug === schoolSlug) ?? schools.find((s) => s.id === schoolSlug) ?? null;

  if (!school) {
    school = await queryClient.fetchQuery({
      queryKey: schoolKeys.detail(schoolSlug),
      queryFn: () => getSchool(schoolSlug),
    });
  } else {
    queryClient.setQueryData(schoolKeys.detail(schoolSlug), school);
  }

  if (!school) {
    redirect(`/${locale}/school`);
  }

  // Prefer myRole from list response (injected by org-service after Step 1 backend change).
  // Fall back to ownerId check for backwards-compat while backend deploys.
  let dashboardRole: DashboardRole;
  if (school.myRole) {
    dashboardRole = SCHOOL_ROLE_TO_DASHBOARD[school.myRole] ?? 'teacher';
  } else if (school.ownerId && school.ownerId === user.userId) {
    dashboardRole = 'owner';
  } else {
    dashboardRole = 'teacher';
  }

  const schoolType = deriveSchoolType(school);
  const schoolContext: SchoolContext = {
    role: dashboardRole,
    schoolType,
    school: { name: school.name, slug: school.slug ?? school.id },
    schoolId: school.id,
  };

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WorkspaceActivator contextKey={`school:${school.id}`} />
      <AppShell variant="school" user={user} schoolContext={schoolContext}>
        {children}
      </AppShell>
    </HydrationBoundary>
  );
}
