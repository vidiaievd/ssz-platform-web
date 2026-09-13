import { notFound } from 'next/navigation';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { SchoolStudentCard } from './school-student';
import { TutorStudentCard } from './tutor-student';

type Props = {
  params: Promise<{ workspaceId: string; studentId: string; locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * One learner.
 *
 * The school's card carries groups, transfers and a level history a school keeps; the
 * tutor's is the two tabs a tutor actually uses. Same person, same address, different
 * amount of institution around them.
 */
export default async function WorkspaceStudentPage({ params, searchParams }: Props) {
  const { workspaceId } = await params;

  const workspace = await resolveWorkspace(workspaceId);
  if (!workspace) notFound();

  return workspace.kind === 'SOLO' ? (
    <TutorStudentCard params={params} searchParams={searchParams} />
  ) : (
    <SchoolStudentCard params={params} searchParams={searchParams} />
  );
}
