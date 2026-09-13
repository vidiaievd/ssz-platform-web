import { notFound } from 'next/navigation';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { SchoolDashboard } from './school-dashboard';
import { TutorDashboard } from './tutor-dashboard';

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
};

/**
 * The workspace's front page — one address, two screens.
 *
 * A school's dashboard is about an organisation: enrolment queues, teacher load, groups at
 * risk. A tutor's is about their own week. They share an address because they answer the
 * same question — what needs me today — and which one is drawn follows from `kind`, never
 * from the shape of the URL (plan 61, phase 4).
 */
export default async function WorkspaceDashboardPage({ params }: Props) {
  const { workspaceId } = await params;

  const workspace = await resolveWorkspace(workspaceId);
  if (!workspace) notFound();

  return workspace.kind === 'SOLO' ? (
    <TutorDashboard workspaceId={workspace.id} />
  ) : (
    <SchoolDashboard params={params} />
  );
}
