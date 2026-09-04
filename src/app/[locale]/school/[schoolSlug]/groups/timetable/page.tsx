import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { getTimetable } from '@/features/groups/api/queries';
import { TeacherTimetable } from '@/features/groups/components/teacher-timetable';
import { AlertCircle } from 'lucide-react';

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
  searchParams: Promise<{ teacher?: string }>;
};

export default async function TimetablePage({ params, searchParams }: Props) {
  const { schoolSlug } = await params;
  const { teacher: teacherId } = await searchParams;
  const t = await getTranslations('Groups');

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const timetableResult = await getTimetable(school.id);

  const teachers = 'data' in timetableResult ? timetableResult.data : [];
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
          {t('timetable.back')}
        </Link>
        <h1 className="text-2xl font-bold text-(--ssz-text-primary)">{t('timetable.title')}</h1>
        <p className="mt-0.5 text-sm text-(--ssz-text-muted)">{t('timetable.subtitle')}</p>
      </div>

      {'error' in timetableResult ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">{t('timetable.errorTitle')}</p>
            <p className="mt-0.5 text-destructive/80">{timetableResult.error}</p>
          </div>
        </div>
      ) : teachers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-sm text-(--ssz-text-muted)">
            {t('timetable.noTeachers')}
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
