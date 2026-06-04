import { notFound } from 'next/navigation';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { getTeacherAssignCandidates } from '@/features/groups/api/queries';
import { TeacherAssignModal } from '@/features/groups/components/teacher-assign-modal';

type Props = {
  params: Promise<{ schoolSlug: string; groupId: string; locale: string }>;
};

export default async function AssignTeacherModal({ params }: Props) {
  const { schoolSlug, groupId } = await params;

  const school = await getSchoolBySlug(schoolSlug);
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
      schoolSlug={schoolSlug}
    />
  );
}
