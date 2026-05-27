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
import { AppShell } from '@/components/shared/app-shell';

type Props = {
  children: React.ReactNode;
  params: Promise<{ schoolId: string }>;
};

export default async function SchoolInstanceLayout({ children, params }: Props) {
  const { schoolId } = await params;
  const user = await requireAnyRole(['tutor', 'school_admin']);
  const locale = await getLocale();

  const queryClient = getQueryClient();
  const [school] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: schoolKeys.detail(schoolId),
      queryFn: () => getSchool(schoolId),
    }),
    queryClient.prefetchQuery({
      queryKey: profileKeys.me(),
      queryFn: getMyProfile,
    }),
    queryClient.prefetchQuery({
      queryKey: schoolKeys.mine(),
      queryFn: getMySchools,
    }),
  ]);

  // If the school doesn't exist or the user has no access, fall back to the
  // school index which will redirect to their first accessible school.
  if (!school) {
    redirect(`/${locale}/school`);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AppShell variant="school" user={user}>
        {children}
      </AppShell>
    </HydrationBoundary>
  );
}
