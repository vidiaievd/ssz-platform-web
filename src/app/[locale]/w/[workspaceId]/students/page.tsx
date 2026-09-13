import { notFound } from 'next/navigation';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { SchoolRoster } from './school-roster';
import { TutorRoster } from './tutor-roster';

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
  searchParams: Promise<{ q?: string; segment?: string }>;
};

/**
 * Everyone learning here.
 *
 * A school's roster is segmented, enrolled in bulk and filtered in the browser; a tutor's
 * is four columns and one search field, because a workspace of a dozen learners does not
 * need the machinery. Same address, chosen by `kind`.
 */
export default async function WorkspaceStudentsPage({ params, searchParams }: Props) {
  const { workspaceId } = await params;

  const workspace = await resolveWorkspace(workspaceId);
  if (!workspace) notFound();

  return workspace.kind === 'SOLO' ? (
    <TutorRoster params={params} searchParams={searchParams} />
  ) : (
    <SchoolRoster params={params} searchParams={searchParams} />
  );
}
