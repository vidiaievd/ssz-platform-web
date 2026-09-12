import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { requireAnyRole } from '@/lib/auth/protect';
import { getQueryClient } from '@/lib/query/client';
import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { profileKeys } from '@/features/profile/api/keys';
import { AppShell } from '@/components/shared/app-shell';
import { WorkspaceActivator } from '@/features/workspaces/components/workspace-activator';
import { getTutorWorkspace } from '@/features/tutoring/api/get-tutor-workspace';

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
  const [workspace] = await Promise.all([
    // The shell needs the workspace id for the marking badge, and this is the one place
    // every tutor screen passes through.
    getTutorWorkspace(),
    queryClient.prefetchQuery({
      queryKey: profileKeys.me(),
      queryFn: getMyProfile,
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WorkspaceActivator contextKey="private_tutor" />
      <AppShell
        variant="tutor"
        user={user}
        tutorUserId={userId}
        tutorWorkspaceId={workspace?.schoolId}
      >
        {children}
      </AppShell>
    </HydrationBoundary>
  );
}
