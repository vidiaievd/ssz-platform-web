'use client';

import { BookOpen, Compass } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/features/learning/components/empty-state';
import { ErrorState } from '@/features/learning/components/error-state';
import { getEndonym } from '@/features/profile/lib/iso-languages';
import { useContinueLearning } from '@/features/student/api/use-continue-learning';
import type { ContainerProgress } from '@/features/student/types';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { byRecency, resumeHref, type SchoolCourseMap } from '../lib/course-view';
import { CourseProgressCard, type CourseProgressCardData } from './course-progress-card';
import { HSection } from './h-section';
import { TextLink } from './text-link';

const PREVIEW_LIMIT = 4;

export interface MyCoursesPreviewProps {
  /** Container ids reachable through a school group → that school's name. */
  schoolCourses: SchoolCourseMap;
}

/** The four most recently touched courses, with a link through to the full list. */
export function MyCoursesPreview({ schoolCourses }: MyCoursesPreviewProps) {
  const t = useTranslations('Student.home.myCourses');
  const format = useFormatter();
  const router = useRouter();
  const { data, isLoading, error, refetch } = useContinueLearning();

  function toCard(item: ContainerProgress): CourseProgressCardData {
    const school = schoolCourses[item.containerId];
    return {
      id: item.containerId,
      langCode: item.targetLanguage,
      langName: getEndonym(item.targetLanguage),
      level: item.level ?? '',
      title: item.containerTitle,
      source: school ? 'school' : 'self',
      school,
      progressPercent: item.progressPercent,
      completedItems: item.completedItems,
      totalItems: item.totalItems,
      nextUnitLabel: t('lessonNumber', { n: item.completedItems + 1 }),
      nextItemTitle: item.nextItemTitle ?? t('courseComplete'),
      lastActiveLabel: item.lastAccessedAt
        ? format.relativeTime(new Date(item.lastAccessedAt))
        : undefined,
    };
  }

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
          {courses.map((item) => (
            <CourseProgressCard
              key={item.containerId}
              course={toCard(item)}
              onOpen={() => router.push(resumeHref(item))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
