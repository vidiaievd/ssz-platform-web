'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';

import { ExerciseSolver } from '@/features/student/reader';

import { ReturnedBanner } from './returned-banner';

/**
 * One exercise on its own page, for the go that follows a returned verdict (plan 47.3).
 *
 * The reader is where exercises normally live, but it is addressed by course, unit and
 * item — and a submission knows none of those, only which exercise it was. That is enough
 * to open the exercise itself, which is all a second attempt needs: the task, the comment
 * that sent it back, and the way home.
 *
 * `?from=submission&attempt=<id>` is what makes it a second attempt rather than practice.
 * Without those the page is still perfectly usable — it is the exercise — which is the
 * right behaviour for a link that has been shared or has outlived its verdict.
 */
export function RedoExercisePage({ exerciseId }: { exerciseId: string }) {
  const t = useTranslations('Review.student.redo');
  const searchParams = useSearchParams();

  const attemptId = searchParams.get('from') === 'submission' ? searchParams.get('attempt') : null;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col px-6 pb-14 pt-6 sm:px-8">
      <Link
        href="/student/submissions"
        className="mb-4 inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-(--ssz-text-secondary) hover:text-(--ssz-text-primary)"
      >
        <ArrowLeft size={15} aria-hidden />
        {t('back')}
      </Link>

      {attemptId !== null && attemptId !== '' && (
        <ReturnedBanner exerciseId={exerciseId} attemptId={attemptId} />
      )}

      <ExerciseSolver exerciseId={exerciseId} />
    </div>
  );
}
