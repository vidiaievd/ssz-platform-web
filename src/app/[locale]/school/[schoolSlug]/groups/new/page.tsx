import { notFound } from 'next/navigation';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { getSchoolTeachers, getTimetable, getSchoolStudents } from '@/features/groups/api/queries';
import { GroupCreateFlow } from '@/features/groups/components/group-create-flow';

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
};

export default async function NewGroupPage({ params }: Props) {
  const { schoolSlug, locale } = await params;

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const [teachers, timetable, students] = await Promise.all([
    getSchoolTeachers(school.id),
    getTimetable(school.id),
    getSchoolStudents(school.id),
  ]);

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
        schoolSlug={schoolSlug}
        locale={locale}
        teachers={teachers}
        timetable={timetable}
        students={students}
      />
    </main>
  );
}
