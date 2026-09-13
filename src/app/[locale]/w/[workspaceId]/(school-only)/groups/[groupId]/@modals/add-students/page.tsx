import { notFound } from 'next/navigation';

import { getSchoolByRef } from '@/features/school/api/get-school-by-ref';
import { getStudentCandidates } from '@/features/groups/api/queries';
import { StudentAssignModal } from '@/features/groups/components/student-assign-modal';

type Props = {
  params: Promise<{ workspaceId: string; groupId: string; locale: string }>;
};

export default async function AddStudentsModal({ params }: Props) {
  const { workspaceId, groupId } = await params;

  const school = await getSchoolByRef(workspaceId);
  if (!school) notFound();

  const { groupName, currentCount, capacity, candidates } =
    await getStudentCandidates(school.id, groupId);

  return (
    <StudentAssignModal
      groupId={groupId}
      groupName={groupName}
      capacity={capacity}
      currentCount={currentCount}
      candidates={candidates}
      schoolId={school.id}
    />
  );
}
