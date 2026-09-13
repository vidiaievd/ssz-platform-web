import { notFound } from 'next/navigation';

import { getSchoolByRef } from '@/features/school/api/get-school-by-ref';
import { getTeacherAssignCandidates } from '@/features/groups/api/queries';
import { TeacherAssignModal } from '@/features/groups/components/teacher-assign-modal';

type Props = {
  params: Promise<{ workspaceId: string; groupId: string; locale: string }>;
};

export default async function AssignTeacherModal({ params }: Props) {
  const { workspaceId, groupId } = await params;

  const school = await getSchoolByRef(workspaceId);
  if (!school) notFound();

  const { groupName, groupLang, groupSlots, candidates } =
    await getTeacherAssignCandidates(school.id, groupId);

  return (
    <TeacherAssignModal
      groupId={groupId}
      groupName={groupName}
      groupLang={groupLang}
      groupSlots={groupSlots}
      candidates={candidates}
      schoolId={school.id}
      workspaceId={workspaceId}
    />
  );
}
