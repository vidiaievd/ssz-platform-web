import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { getTimetable } from '@/features/groups/api/queries';
import { TeacherTimetable } from '@/features/groups/components/teacher-timetable';

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
  searchParams: Promise<{ teacher?: string }>;
};

export default async function TimetablePage({ params, searchParams }: Props) {
  const { schoolSlug } = await params;
  const { teacher: teacherId } = await searchParams;

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const teachers = await getTimetable(school.id);

  const selectedId = teacherId
    ? (teachers.find((t) => t.userId === teacherId)?.userId ?? teachers[0]?.userId ?? null)
    : (teachers[0]?.userId ?? null);

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <Link
          href={`/school/${schoolSlug}/groups`}
          className="inline-flex items-center gap-1 text-sm text-(--ssz-text-secondary) hover:text-(--ssz-text-primary) transition-colors mb-3"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Groups
        </Link>
        <h1 className="text-2xl font-bold text-(--ssz-text-primary)">Teacher timetable</h1>
        <p className="mt-0.5 text-sm text-(--ssz-text-muted)">
          Weekly schedule, workload, and scheduling conflicts.
        </p>
      </div>

      {teachers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-sm text-(--ssz-text-muted)">
            No active teachers with scheduled groups found.
          </p>
        </div>
      ) : (
        <TeacherTimetable
          teachers={teachers}
          selectedTeacherId={selectedId}
          schoolSlug={schoolSlug}
        />
      )}
    </main>
  );
}
