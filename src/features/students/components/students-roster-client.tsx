'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { UserPlus, Upload, MessageSquare, AlertTriangle, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { segmentPredicate } from '@/lib/students/status';
import { useStudents } from '../api/use-students';
import { StudentsFilters } from './students-filters';
import { StudentsList } from './students-list';
import type { StudentsListResult, SegmentKey } from '@/features/students/types';

type Props = {
  schoolId: string;
  schoolSlug: string;
  initial: StudentsListResult;
};

export function StudentsRosterClient({ schoolId, schoolSlug, initial }: Props) {
  const t = useTranslations('Students');
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const activeSegment = (searchParams.get('segment') as SegmentKey | null) ?? 'all';

  const { data } = useStudents(schoolId, { search: q, initialData: initial });
  const students = data.items;
  const total = data.total;

  const atRiskCount = students.filter(segmentPredicate('at-risk')).length;
  const unassignedCount = students.filter(segmentPredicate('no-group')).length;

  const enrollHref = `?enroll=1`;

  return (
    <>
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

      {/* Filter island */}
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
          search={q}
        />
      )}
    </>
  );
}
