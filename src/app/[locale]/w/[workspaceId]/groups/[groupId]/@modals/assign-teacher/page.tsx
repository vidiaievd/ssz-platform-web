import { notFound } from 'next/navigation';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { getTeacherAssignCandidates } from '@/features/groups/api/queries';
import { TeacherAssignModal } from '@/features/groups/components/teacher-assign-modal';

type Props = {
  params: Promise<{ workspaceId: string; groupId: string; locale: string }>;
};

export default async function AssignTeacherModal({ params }: Props) {
  const { workspaceId, groupId } = await params;

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
