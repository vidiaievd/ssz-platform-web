import { notFound } from 'next/navigation';

import { isWorkspaceWritable } from '@/features/school-lifecycle/api/get-workspace-lifecycle';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { getTeacherAssignCandidates } from '@/features/groups/api/queries';
import { TeacherAssignModal } from '@/features/groups/components/teacher-assign-modal';

type Props = {
  params: Promise<{ workspaceId: string; groupId: string; locale: string }>;
};

export default async function AssignTeacherModal({ params }: Props) {
  const { workspaceId, groupId } = await params;
  // A read-only workspace opens no dialog that changes it (plan 90, live check, block 9).
  if (!(await isWorkspaceWritable(workspaceId))) return null;

  const workspace = await resolveWorkspace(workspaceId);
  if (!workspace) notFound();

  const { groupName, groupLang, groupSlots, candidates } =
    await getTeacherAssignCandidates(workspace.id, groupId);

  return (
    <TeacherAssignModal
      groupId={groupId}
      groupName={groupName}
      groupLang={groupLang}
      groupSlots={groupSlots}
      candidates={candidates}
      schoolId={workspace.id}
      workspaceId={workspaceId}
    />
  );
}
