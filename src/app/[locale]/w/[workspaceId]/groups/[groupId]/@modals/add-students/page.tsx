import { notFound } from 'next/navigation';

import { isWorkspaceWritable } from '@/features/school-lifecycle/api/get-workspace-lifecycle';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { getStudentCandidates } from '@/features/groups/api/queries';
import { StudentAssignModal } from '@/features/groups/components/student-assign-modal';

type Props = {
  params: Promise<{ workspaceId: string; groupId: string; locale: string }>;
};

export default async function AddStudentsModal({ params }: Props) {
  const { workspaceId, groupId } = await params;
  // A read-only workspace opens no dialog that changes it (plan 90, live check, block 9).
  if (!(await isWorkspaceWritable(workspaceId))) return null;

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
