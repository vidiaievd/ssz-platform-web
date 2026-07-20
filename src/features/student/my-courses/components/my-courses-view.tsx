'use client';

import { Compass } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/features/learning/components/empty-state';
import { ErrorState } from '@/features/learning/components/error-state';
import { LearningSkeleton } from '@/features/learning/components/learning-skeleton';
import { CourseProgressCard } from '@/features/student/home/components';
import { byRecency, courseHref, toCourseCardData } from '@/features/student/home/lib/course-view';
import { useMyCourses } from '@/features/student/api/use-my-courses';
import { myCoursesFiltersSchema, type MyCoursesFilter } from '@/features/student/schemas/my-courses-filters';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useUrlFilters } from '@/lib/url-filters/use-url-filters';
import { SourceFilterPills } from './source-filter-pills';

const GRID_CLASS = 'grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]';

/** Filterable grid of every course the student can open, backed by `?source=` in the URL. */
export function MyCoursesView() {
  const t = useTranslations('Student.myCoursesPage');
  const tCourse = useTranslations('Student.home.myCourses');
  const format = useFormatter();
  const router = useRouter();
  const { data, isLoading, error, refetch } = useMyCourses();
  const [filters, setFilters] = useUrlFilters(myCoursesFiltersSchema);
  const active: MyCoursesFilter = filters.source ?? 'all';

  const courses = [...(data ?? [])].sort(byRecency);
  const counts: Record<MyCoursesFilter, number> = {
    all: courses.length,
    school: courses.filter((c) => c.source === 'school').length,
    self: courses.filter((c) => c.source === 'self').length,
    free: courses.filter((c) => c.source === 'free').length,
  };
  const filtered = active === 'all' ? courses : courses.filter((c) => c.source === active);

  return (
    <div>
      <SourceFilterPills
        active={active}
        counts={counts}
        onChange={(source) => setFilters({ source: source === 'all' ? undefined : source })}
      />

      <div className="mt-5">
        {isLoading ? (
          <div className={GRID_CLASS}>
            {Array.from({ length: 4 }).map((_, i) => (
              <LearningSkeleton key={i} variant="card" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface">
            <ErrorState onRetry={() => void refetch()} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border-[1.5px] border-dashed border-(--ssz-border-strong) bg-surface">
            <EmptyState
              icon={Compass}
              title={t(`empty.${active}`)}
              description={t('empty.description')}
              action={
                <Button asChild variant="primary" size="sm">
                  <Link href="/student/catalogue">{t('empty.cta')}</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className={GRID_CLASS}>
            {filtered.map((course) => (
              <CourseProgressCard
                key={course.containerId}
                course={toCourseCardData(
                  course,
                  { lessonNumber: (n) => tCourse('lessonNumber', { n }), notStarted: tCourse('notStarted') },
                  (d) => format.relativeTime(d),
                )}
                onOpen={() => router.push(courseHref(course))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
