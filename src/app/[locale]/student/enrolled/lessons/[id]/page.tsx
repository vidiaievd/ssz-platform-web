import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { GraduationCap, Globe } from 'lucide-react';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { DataState } from '@/components/shared/data-state';
import { LessonRenderer } from '@/features/content/components/lesson-renderer';
import type { Lesson, LessonVariant } from '@/features/content/types';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function LessonPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations('Content');

  let lesson: Lesson;
  let variant: LessonVariant | null = null;

  try {
    [lesson, variant] = await Promise.all([
      serverFetch<Lesson>({ service: 'content', path: `/api/v1/lessons/${id}` }),
      serverFetch<LessonVariant>({
        service: 'content',
        path: `/api/v1/lessons/${id}/variants/best`,
      }).catch(() => null),
    ]);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') notFound();
    throw e;
  }

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      <div className="text-muted-foreground mb-6 flex flex-wrap gap-4 text-sm">
        {lesson.targetLanguage && (
          <span className="flex items-center gap-1.5">
            <Globe className="h-4 w-4" />
            {lesson.targetLanguage.toUpperCase()}
          </span>
        )}
        {lesson.level && (
          <span className="flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4" />
            {lesson.level}
          </span>
        )}
      </div>

      {variant ? (
        <LessonRenderer variant={variant} />
      ) : (
        <DataState
          isEmpty
          emptySlot={
            <div className="py-16 text-center">
              <p className="text-muted-foreground text-sm">{t('noLessonContent')}</p>
            </div>
          }
        >
          {null}
        </DataState>
      )}
    </main>
  );
}
