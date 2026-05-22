import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { requireAnyRole } from '@/lib/auth/protect';
import { getQueryClient } from '@/lib/query/client';
import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { profileKeys } from '@/features/profile/api/keys';
import { AppShell } from '@/components/shared/app-shell';

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAnyRole(['school', 'tutor']);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: profileKeys.me(),
    queryFn: getMyProfile,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AppShell variant="school" user={user}>
        {children}
      </AppShell>
    </HydrationBoundary>
  );
}
