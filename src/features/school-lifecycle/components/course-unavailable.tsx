'use client';

import { Archive } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

interface CourseUnavailableProps {
  /** `forbidden`: not open to this learner (403); `gone`: deleted, e.g. with its school (404). */
  kind: 'forbidden' | 'gone';
}

/** What a learner sees instead of a blank screen when a school's course cannot be opened (plan 90). */
export function CourseUnavailable({ kind }: CourseUnavailableProps) {
  const t = useTranslations('SchoolLifecycle.unavailable');

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4" role="alert">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-(--ssz-bg-muted)">
          <Archive className="size-6 text-(--ssz-text-muted)" aria-hidden="true" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-(--ssz-text-primary)">
            {kind === 'gone' ? t('courseGoneTitle') : t('courseForbiddenTitle')}
          </h1>
          <p className="text-sm text-(--ssz-text-muted)">
            {kind === 'gone' ? t('courseGoneBody') : t('courseForbiddenBody')}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/student/my-courses">{t('myCourses')}</Link>
        </Button>
      </div>
    </main>
  );
}
