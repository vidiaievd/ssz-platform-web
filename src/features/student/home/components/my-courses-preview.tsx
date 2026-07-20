'use client';

import { BookOpen, Compass } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/features/learning/components/empty-state';
import { ErrorState } from '@/features/learning/components/error-state';
import { useMyCourses } from '@/features/student/api/use-my-courses';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { byRecency, courseHref, toCourseCardData } from '../lib/course-view';
import { CourseProgressCard } from './course-progress-card';
import { HSection } from './h-section';
import { TextLink } from './text-link';

const PREVIEW_LIMIT = 4;

/** The four most relevant courses, with a link through to the full list. */
export function MyCoursesPreview() {
  const t = useTranslations('Student.home.myCourses');
  const format = useFormatter();
  const router = useRouter();
  const { data, isLoading, error, refetch } = useMyCourses();

  const courses = [...(data ?? [])].sort(byRecency).slice(0, PREVIEW_LIMIT);

  return (
    <section>
      <HSection
        icon={BookOpen}
        title={t('title')}
        sub={t('subtitle')}
        action={<TextLink onClick={() => router.push('/student/my-courses')}>{t('viewAll')}</TextLink>}
      />

      {isLoading ? (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface">
          <ErrorState onRetry={() => void refetch()} />
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface">
          <EmptyState
            icon={Compass}
            title={t('emptyTitle')}
            description={t('emptyDescription')}
            action={
              <Button asChild variant="primary" size="sm">
                <Link href="/student/catalogue">{t('emptyCta')}</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {courses.map((course) => (
            <CourseProgressCard
              key={course.containerId}
              course={toCourseCardData(
                course,
                { lessonNumber: (n) => t('lessonNumber', { n }), notStarted: t('notStarted') },
                (d) => format.relativeTime(d),
              )}
              onOpen={() => router.push(courseHref(course))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
