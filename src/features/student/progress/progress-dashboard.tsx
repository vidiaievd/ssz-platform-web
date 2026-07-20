'use client';

import { Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { EmptyState } from '@/features/learning/components/empty-state';
import { ErrorState } from '@/features/learning/components/error-state';
import { LearningSkeleton } from '@/features/learning/components/learning-skeleton';
import { useMyCourses } from '@/features/student/api/use-my-courses';
import { courseHref } from '@/features/student/home/lib/course-view';
import { useRouter } from '@/lib/i18n/navigation';
import { ProgressCourseRow } from './progress-course-row';

/** Plain per-course progress list — no streaks, XP, or mastery ornamentation. */
export function ProgressDashboard() {
  const t = useTranslations('Student.progressPage');
  const router = useRouter();
  const { data, isLoading, error, refetch } = useMyCourses();

  return (
    <div className="mx-auto max-w-205 px-4.5 py-5.5 sm:px-8.5 sm:py-7.5">
      <p className="mb-2 text-[11px] font-bold tracking-[0.08em] text-(--ssz-color-primary-500) uppercase">
        {t('eyebrow')}
      </p>
      <h1 className="text-[24px] leading-tight font-bold tracking-[-0.02em] text-(--ssz-text-primary) sm:text-[29px]">
        {t('title')}
      </h1>
      <p className="mt-1.5 mb-6.5 max-w-xl text-[14.5px] text-(--ssz-text-secondary)">
        {t('subtitle')}
      </p>

      {isLoading ? (
        <LearningSkeleton variant="list" rows={4} />
      ) : error ? (
        <div className="rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface">
          <ErrorState onRetry={() => void refetch()} />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-lg border-[1.5px] border-dashed border-(--ssz-border-strong) bg-surface">
          <EmptyState icon={Layers} title={t('empty.title')} description={t('empty.body')} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((course) => (
            <ProgressCourseRow
              key={course.containerId}
              course={course}
              onOpen={() => router.push(courseHref(course))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
