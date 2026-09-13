import { notFound } from 'next/navigation';

import { getSchoolByRef } from '@/features/school/api/get-school-by-ref';
import { getSchoolTeachers, getTimetable, getSchoolStudents } from '@/features/groups/api/queries';
import { GroupCreateFlow } from '@/features/groups/components/group-create-flow';

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
};

export default async function NewGroupPage({ params }: Props) {
  const { workspaceId, locale } = await params;

  const school = await getSchoolByRef(workspaceId);
  if (!school) notFound();

  const [teachers, timetableResult, students] = await Promise.all([
    getSchoolTeachers(school.id),
    getTimetable(school.id),
    getSchoolStudents(school.id),
  ]);
  const timetable = 'data' in timetableResult ? timetableResult.data : [];

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-(--ssz-text-primary)">New group</h1>
        <p className="mt-1 text-sm text-(--ssz-text-muted)">
          Groups are created as drafts. Publish when teachers and schedule are confirmed.
        </p>
      </div>

      <GroupCreateFlow
        schoolId={school.id}
        workspaceId={workspaceId}
        locale={locale}
        teachers={teachers}
        timetable={timetable}
        students={students}
      />
    </main>
  );
}
