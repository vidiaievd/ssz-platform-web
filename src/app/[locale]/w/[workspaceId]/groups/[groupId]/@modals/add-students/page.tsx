import { notFound } from 'next/navigation';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { getStudentCandidates } from '@/features/groups/api/queries';
import { StudentAssignModal } from '@/features/groups/components/student-assign-modal';

type Props = {
  params: Promise<{ workspaceId: string; groupId: string; locale: string }>;
};

export default async function AddStudentsModal({ params }: Props) {
  const { workspaceId, groupId } = await params;

  const workspace = await resolveWorkspace(workspaceId);
  if (!workspace) notFound();

  const { groupName, currentCount, capacity, candidates } =
    await getStudentCandidates(workspace.id, groupId);

  return (
    <StudentAssignModal
      groupId={groupId}
      groupName={groupName}
      capacity={capacity}
      currentCount={currentCount}
      candidates={candidates}
      schoolId={workspace.id}
    />
  );
}
