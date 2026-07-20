'use client';

import { Compass } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/features/learning/components/empty-state';
import { ErrorState } from '@/features/learning/components/error-state';
import { useMyCourses } from '@/features/student/api/use-my-courses';
import { Link } from '@/lib/i18n/navigation';
import { pickResumeCourse, toResumeHero } from '../lib/course-view';
import { ResumeHero } from './resume-hero';

/** Wraps `ResumeHero` with the loading / empty / error states of the courses query. */
export function ResumePanel() {
  const t = useTranslations('Student.home.resume');
  const { data, isLoading, error, refetch } = useMyCourses();

  if (isLoading) {
    return <Skeleton className="h-63 w-full rounded-xl" />;
  }

  if (error) {
    return (
      <div className="rounded-xl border-[1.5px] border-(--ssz-border-default) bg-surface">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  const course = pickResumeCourse(data ?? []);

  if (!course) {
    return (
      <div className="rounded-xl border-[1.5px] border-(--ssz-border-default) bg-surface">
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
    );
  }

  return <ResumeHero course={toResumeHero(course)} />;
}
