'use client';

import { useTranslations } from 'next-intl';
import { Check, Inbox } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { useAuthoringExercise, useReviewQueue } from '@/features/content-authoring/api';
import { readAuthoredItems } from '@/features/content-authoring/lib/authored-items';

import { SubmissionCard } from './submission-card';

export interface ReviewQueueProps {
  exerciseId: string;
}

/**
 * The teacher's queue for one exercise: everything the auto-check refused to close.
 *
 * This screen is the other half of the translate template rather than an extra. The check
 * may only ever approve, so every honest translation that misses the key by a word lands
 * here — without the queue, a learner who wrote a perfectly good sentence the author never
 * thought of is told nothing at all, forever.
 *
 * It is written over attempts in `ROUTED_FOR_REVIEW` without caring which template
 * produced them; only the reading of one item is template-specific. `error_correction`
 * marks here too, on the same argument — its check may only ever approve either.
 */
export function ReviewQueue({ exerciseId }: ReviewQueueProps) {
  const t = useTranslations('Authoring');
  const { data: queue, isLoading, isError } = useReviewQueue(exerciseId);
  const { data: exercise } = useAuthoringExercise(exerciseId);

  // The sentences as their author wrote them: what the learner was given, and the note
  // left for whoever marks it. The queue itself carries none of that — it carries what the
  // learner wrote and how it was judged.
  const itemsById = readAuthoredItems(exercise);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="rounded-lg border border-border px-4 py-3 text-sm text-error" role="status">
        {t('review.loadFailed')}
      </p>
    );
  }

  const items = queue?.items ?? [];

  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
        <Check className="size-4 text-success-700" aria-hidden />
        {t('review.empty')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-sm text-[var(--ssz-text-secondary)]">
        <Inbox className="size-4" aria-hidden />
        {t('review.waiting', { count: queue?.total ?? items.length })}
      </p>

      <ul className="flex flex-col gap-4">
        {items.map((entry) => (
          <li key={entry.attemptId}>
            <SubmissionCard
              exerciseId={exerciseId}
              entry={entry}
              itemsById={itemsById}
              learner={queue?.learners[entry.userId]}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
