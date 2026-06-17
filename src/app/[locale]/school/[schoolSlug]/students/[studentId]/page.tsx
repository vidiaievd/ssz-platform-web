import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { getStudent } from '@/features/students/api/queries';
import { StudentDetailHeader } from '@/features/students/components/student-detail';
import { StudentGroupsPanel } from '@/features/students/components/student-groups-panel';
import { StudentProgressPanel } from '@/features/students/components/student-progress-panel';
type Props = {
  params: Promise<{ schoolSlug: string; studentId: string; locale: string }>;
};

export default async function StudentDetailPage({ params }: Props) {
  const { schoolSlug, studentId } = await params;
  const t = await getTranslations('Students');

  const school = await getSchoolBySlug(schoolSlug);
  const student = school ? await getStudent(school.id, studentId) : null;

  if (!school || !student) notFound();

  const addToGroupHref = `?add-to-group=1`;

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href={`/school/${schoolSlug}/students`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t('detail.backToStudents')}
      </Link>

      {/* Header + clash banner */}
      {student.clashesError && (
        <p className="text-sm text-destructive">{student.clashesError}</p>
      )}
      <StudentDetailHeader
        student={student}
        schoolId={school.id}
        addToGroupHref={addToGroupHref}
      />

      {/* 2-column body: groups left, progress right (mobile: stacked, groups first) */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <StudentGroupsPanel
          student={student}
          schoolId={school.id}
          schoolSlug={schoolSlug}
          addToGroupHref={addToGroupHref}
        />
        <StudentProgressPanel student={student} />
      </div>
    </main>
  );
}
