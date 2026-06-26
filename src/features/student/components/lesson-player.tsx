'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { DataState } from '@/components/shared/data-state';
import { LessonRenderer } from '@/features/content/components/lesson-renderer';
import type { Lesson, LessonVariant } from '@/features/content/types';
import { useRouter } from '@/lib/i18n/navigation';
import { markLessonStartedAction, markLessonCompletedAction } from '../actions/lesson-progress';
import { LessonNavigation } from './lesson-navigation';
import { LessonProgress } from './lesson-progress';

interface LessonPlayerProps {
  lesson: Lesson;
  variant: LessonVariant | null;
  prevId?: string;
  nextId?: string;
  position?: number;
  total?: number;
  containerTitle?: string;
  containerId?: string;
}

function buildLessonHref(lessonId: string, containerId?: string) {
  const base = `/student/enrolled/lessons/${lessonId}`;
  return containerId ? `${base}?containerId=${containerId}` : base;
}

export function LessonPlayer({
  lesson,
  variant,
  prevId,
  nextId,
  position,
  total,
  containerTitle,
  containerId,
}: LessonPlayerProps) {
  const t = useTranslations('Student');
  const tErrors = useTranslations('Errors');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCompleted, setIsCompleted] = useState(false);
  const startedRef = useRef(false);
  const startedAtRef = useRef(0);

  const prevHref = prevId ? buildLessonHref(prevId, containerId) : undefined;
  const nextHref = nextId ? buildLessonHref(nextId, containerId) : undefined;

  // Mark lesson as started on first render — fire and forget.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startedAtRef.current = Date.now();
    void markLessonStartedAction(lesson.id);
  }, [lesson.id]);

  // Keyboard shortcuts: ← prev, → next, Esc exit.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === 'ArrowRight' && nextHref) {
        router.push(nextHref as never);
      } else if (e.key === 'ArrowLeft' && prevHref) {
        router.push(prevHref as never);
      } else if (e.key === 'Escape') {
        router.push('/student/dashboard' as never);
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [prevHref, nextHref, router]);

  function handleComplete() {
    startTransition(async () => {
      const timeSpentSeconds = (Date.now() - startedAtRef.current) / 1000;
      const result = await markLessonCompletedAction(lesson.id, timeSpentSeconds);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      setIsCompleted(true);
      toast.success(t('player.completedToast'));

      if (nextHref) {
        router.push(nextHref as never);
      } else {
        router.push('/student/dashboard' as never);
      }
    });
  }

  return (
    <>
      <LessonProgress
        position={position}
        total={total}
        containerTitle={containerTitle}
      />

      <main className="container mx-auto max-w-3xl px-4 py-8">
        <DataState
          isEmpty={!variant}
          emptySlot={
            <div className="py-16 text-center">
              <p className="text-muted-foreground text-sm">{t('player.noContent')}</p>
            </div>
          }
        >
          {variant && <LessonRenderer variant={variant} />}
        </DataState>

        <LessonNavigation
          prevHref={prevHref}
          nextHref={nextHref}
          onComplete={handleComplete}
          isCompleted={isCompleted}
          isPending={isPending}
        />
      </main>
    </>
  );
}
