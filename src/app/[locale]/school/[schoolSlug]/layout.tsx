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
import { deriveViewerRole, deriveSchoolType } from '@/features/dashboard/lib/derive';
import { AppShell } from '@/components/shared/app-shell';
import type { SchoolContext } from '@/components/shared/app-shell';

type Props = {
  children: React.ReactNode;
  params: Promise<{ schoolSlug: string }>;
};

export default async function SchoolInstanceLayout({ children, params }: Props) {
  const { schoolSlug } = await params;
  const user = await requireAnyRole(['tutor', 'school_admin']);
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

  // Resolve slug (or UUID fallback) to a concrete school record.
  let school = schools.find((s) => s.slug === schoolSlug) ?? schools.find((s) => s.id === schoolSlug) ?? null;

  // If not found in the cached list, try a direct server lookup (e.g. UUID passed directly).
  if (!school) {
    school = await queryClient.fetchQuery({
      queryKey: schoolKeys.detail(schoolSlug),
      queryFn: () => getSchool(schoolSlug),
    });
  } else {
    // Seed the detail cache under the slug key so client-side useSchool(schoolSlug) hits it.
    queryClient.setQueryData(schoolKeys.detail(schoolSlug), school);
  }

  // If the school doesn't exist or the user has no access, fall back to the
  // school index which will redirect to their first accessible school.
  if (!school) {
    redirect(`/${locale}/school`);
  }

  // Derive per-school role and school type for shell gating.
  // ownerId check works from list-endpoint payloads; members[] needed for admin/teacher.
  const role = user.userId ? deriveViewerRole(school, user.userId) : 'admin';
  const schoolType = deriveSchoolType(school);

  const schoolContext: SchoolContext = {
    role,
    schoolType,
    school: { name: school.name, slug: school.slug ?? school.id },
  };

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AppShell variant="school" user={user} schoolContext={schoolContext}>
        {children}
      </AppShell>
    </HydrationBoundary>
  );
}
