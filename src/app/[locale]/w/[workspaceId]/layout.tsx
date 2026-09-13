import { notFound } from 'next/navigation';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { requireAnyRole } from '@/lib/auth/protect';
import { getQueryClient } from '@/lib/query/client';
import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { profileKeys } from '@/features/profile/api/keys';
import { getSchool } from '@/features/school/api/get-school';
import { schoolKeys } from '@/features/school/api/keys';
import { deriveSchoolType } from '@/features/dashboard/lib/derive';
import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { WorkspaceActivator } from '@/features/workspaces/components/workspace-activator';
import { AppShell } from '@/components/shared/app-shell';
import type { SchoolContext } from '@/components/shared/app-shell';
import type { DashboardRole } from '@/features/dashboard/types';
import type { SchoolRole } from '@/features/school/types';

type Props = {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
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

/**
 * One place to stand in, whoever you are.
 *
 * A school and a private tutor's own workspace are the same kind of place, and the screens
 * under here are the ones they share. Which shell is drawn follows from the workspace's
 * `kind`, and what its controls allow from `myRole` — never from the shape of the address,
 * which is why the address no longer says "school" (plan 61).
 */
export default async function WorkspaceLayout({ children, params }: Props) {
  const { workspaceId } = await params;
  const user = await requireAnyRole(['tutor', 'school_admin', 'teacher', 'student']);

  const workspace = await resolveWorkspace(workspaceId);

  // Not yours and no such workspace are the same answer, here as on the server.
  if (!workspace) notFound();

  // A school's slug still opens its workspace — it is an alias, and every link the app
  // builds already carries the id. Canonicalising it here would mean redirecting from a
  // layout, which knows the workspace but not the rest of the path, and would drop
  // whatever screen the visitor actually asked for. It belongs in middleware, with the
  // whole URL in hand (phase 4).

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ queryKey: profileKeys.me(), queryFn: getMyProfile });

  const isSolo = workspace.kind === 'SOLO';
  let schoolContext: SchoolContext | undefined;

  if (!isSolo) {
    // The school shell shows more of the school than the workspace answer carries — its
    // type decides which of the operational widgets belong on screen at all.
    const school = await queryClient.fetchQuery({
      queryKey: schoolKeys.detail(workspace.id),
      queryFn: () => getSchool(workspace.id),
    });

    schoolContext = {
      role: SCHOOL_ROLE_TO_DASHBOARD[workspace.myRole] ?? 'teacher',
      schoolRole: workspace.myRole,
      schoolType: school ? deriveSchoolType(school) : 'online',
      school: { name: workspace.name, slug: workspace.id },
      schoolId: workspace.id,
    };
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WorkspaceActivator contextKey={isSolo ? 'private_tutor' : `school:${workspace.id}`} />
      <AppShell
        variant={isSolo ? 'tutor' : 'school'}
        user={user}
        schoolContext={schoolContext}
        tutorUserId={isSolo ? (user.userId ?? undefined) : undefined}
        tutorWorkspaceId={isSolo ? workspace.id : undefined}
      >
        {children}
      </AppShell>
    </HydrationBoundary>
  );
}
