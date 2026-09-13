import { notFound } from 'next/navigation';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { SchoolInvitations } from './school-invitations';
import { TutorInvitations } from './tutor-invitations';

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
  searchParams: Promise<{ audience?: string }>;
};

/**
 * Who has been asked to join, and has not answered yet.
 *
 * A school invites teachers, staff and students and needs the audience tabs to tell them
 * apart; a tutor invites learners, and nothing else — so their screen has no tabs and no
 * roles to show.
 */
export default async function WorkspaceInvitationsPage({ params, searchParams }: Props) {
  const { workspaceId } = await params;

  const workspace = await resolveWorkspace(workspaceId);
  if (!workspace) notFound();

  return workspace.kind === 'SOLO' ? (
    <TutorInvitations />
  ) : (
    <SchoolInvitations params={params} searchParams={searchParams} />
  );
}
