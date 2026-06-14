import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { requireAnyRole } from '@/lib/auth/protect';
import { getQueryClient } from '@/lib/query/client';
import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { profileKeys } from '@/features/profile/api/keys';
import { AppShell } from '@/components/shared/app-shell';
import { WorkspaceActivator } from '@/features/workspaces/components/workspace-activator';

type Props = {
  children: React.ReactNode;
  params: Promise<{ userId: string }>;
};

export default async function TutorWorkspaceLayout({ children, params }: Props) {
  const { userId } = await params;
  const user = await requireAnyRole(['tutor']);
  const locale = await getLocale();

  // Guard: only the owner can access their own tutor workspace
  if (user.userId && user.userId !== userId) {
    redirect(`/${locale}/tutor/${user.userId}/dashboard`);
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: profileKeys.me(),
    queryFn: getMyProfile,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WorkspaceActivator contextKey="private_tutor" />
      <AppShell variant="tutor" user={user} tutorUserId={userId}>
        {children}
      </AppShell>
    </HydrationBoundary>
  );
}
