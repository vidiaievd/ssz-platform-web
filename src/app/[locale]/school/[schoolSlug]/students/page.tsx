import Link from 'next/link';
import { UserPlus, Upload, MessageSquare, AlertTriangle, Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';


import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { getStudents } from '@/features/students/api/queries';
import { StudentsFilters } from '@/features/students/components/students-filters';
import { StudentsList } from '@/features/students/components/students-list';
import { Button } from '@/components/ui/button';
import { segmentPredicate } from '@/lib/students/status';
import type { SegmentKey } from '@/features/students/types';

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
  searchParams: Promise<{ q?: string; segment?: string }>;
};

export default async function SchoolStudentsPage({ params, searchParams }: Props) {
  const { schoolSlug } = await params;
  const { q, segment } = await searchParams;
  const t = await getTranslations('Students');

  const school = await getSchoolBySlug(schoolSlug);

  if (!school) {
    return (
      <main className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <p className="text-sm text-muted-foreground">{t('notFound')}</p>
      </main>
    );
  }

  const activeSegment = (segment as SegmentKey | undefined) ?? 'all';
  const { items: students, total } = await getStudents(school.id, {
    search: q,
  });

  const atRiskCount = students.filter(segmentPredicate('at-risk')).length;
  const unassignedCount = students.filter(segmentPredicate('no-group')).length;

  const enrollHref = `?enroll=1`;

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('list.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span>{total} {t('list.enrolled')}</span>
            {atRiskCount > 0 && (
              <>
                {' · '}
                <span className="text-amber-600 font-medium">
                  <AlertTriangle className="inline h-3.5 w-3.5 mr-0.5" aria-hidden />
                  {atRiskCount} {t('list.atRisk')}
                </span>
              </>
            )}
            {unassignedCount > 0 && (
              <>
                {' · '}
                <span className="text-red-600 font-medium">
                  {unassignedCount} {t('list.unassigned')}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`?import=1`}>
              <Upload className="mr-1.5 h-4 w-4" aria-hidden />
              {t('list.importCsv')}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`?bulk-message=1`}>
              <MessageSquare className="mr-1.5 h-4 w-4" aria-hidden />
              {t('list.bulkMessage')}
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={enrollHref}>
              <UserPlus className="mr-1.5 h-4 w-4" aria-hidden />
              {t('list.enroll')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter island (client) */}
      <StudentsFilters students={students} />

      {/* List */}
      {students.length === 0 ? (
        <div className="flex flex-col items-center gap-6 py-24 text-center">
          <Users className="h-12 w-12 text-muted-foreground/40" aria-hidden />
          <div className="space-y-1">
            <p className="text-base font-medium">{t('list.emptyTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('list.emptyDescription')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`?import=1`}>
                <Upload className="mr-1.5 h-4 w-4" aria-hidden />
                {t('list.importCsv')}
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={enrollHref}>
                <UserPlus className="mr-1.5 h-4 w-4" aria-hidden />
                {t('list.enroll')}
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <StudentsList
          students={students}
          schoolSlug={schoolSlug}
          activeSegment={activeSegment}
          search={q ?? ''}
          onEnroll={() => {}}
        />
      )}
    </main>
  );
}
