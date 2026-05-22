import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { requireRole } from '@/lib/auth/protect';
import { getQueryClient } from '@/lib/query/client';
import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { profileKeys } from '@/features/profile/api/keys';
import { AppShell } from '@/components/shared/app-shell';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('student');

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: profileKeys.me(),
    queryFn: getMyProfile,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AppShell variant="student" user={user}>
        {children}
      </AppShell>
    </HydrationBoundary>
  );
}
