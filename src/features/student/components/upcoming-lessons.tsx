'use client';

import { useTranslations } from 'next-intl';
import { BookOpen, GraduationCap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/shared/data-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/lib/i18n/navigation';
import { useUpcomingLessons } from '../api/use-upcoming-lessons';
import type { LessonPreview } from '../types';

function LessonRow({ lesson }: { lesson: LessonPreview }) {
  const t = useTranslations('Student');

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <BookOpen
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{lesson.title}</p>
        <p className="text-muted-foreground truncate text-xs">
          {t('upcomingLessons.in', { container: lesson.containerTitle })}
        </p>
      </div>
      {lesson.level && (
        <Badge variant="muted" className="shrink-0 text-xs">
          {lesson.level}
        </Badge>
      )}
      <Button asChild variant="ghost" size="sm" className="shrink-0">
        <Link href={`/student/enrolled/lessons/${lesson.id}`}>
          {t('upcomingLessons.start')}
        </Link>
      </Button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function UpcomingLessons() {
  const t = useTranslations('Student');
  const { data, isLoading, error } = useUpcomingLessons();
  const lessons = data ?? [];

  return (
    <section aria-labelledby="upcoming-lessons-heading">
      <div className="mb-4">
        <h2 id="upcoming-lessons-heading" className="text-lg font-semibold">
          {t('upcomingLessons.title')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('upcomingLessons.subtitle')}</p>
      </div>

      <DataState
        isLoading={isLoading}
        error={error ? { code: 'unknown' } : null}
        isEmpty={!isLoading && lessons.length === 0}
        loadingSlot={<ListSkeleton />}
        emptySlot={
          <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
            <p className="text-muted-foreground text-sm">{t('upcomingLessons.empty')}</p>
          </div>
        }
      >
        <div className="space-y-2">
          {lessons.map((lesson) => (
            <LessonRow key={lesson.id} lesson={lesson} />
          ))}
        </div>
      </DataState>
    </section>
  );
}
