'use client';

import { useTranslations } from 'next-intl';
import { Check, Inbox } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { useAuthoringExercise, useReviewQueue } from '@/features/content-authoring/api';
import {
  fromPersisted as translateFromPersisted,
  isTranslateCode,
  type Item,
  type TranslateType,
} from '@/lib/shared-kernel/translate';

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
 * produced them; only the card's rendering of one item is template-specific, so
 * `error_correction` joins by teaching `SubmissionCard` to read its details.
 */
export function ReviewQueue({ exerciseId }: ReviewQueueProps) {
  const t = useTranslations('Authoring');
  const { data: queue, isLoading, isError } = useReviewQueue(exerciseId);
  const { data: exercise } = useAuthoringExercise(exerciseId);

  // The sentences as their author wrote them: the source, the note for the teacher, why
  // the key reads the way it does. The queue itself carries none of that — it carries what
  // the learner wrote and how it was judged.
  const itemsById = new Map<string, Item>();
  if (exercise && isTranslateCode(exercise.templateCode)) {
    const document = translateFromPersisted(
      { id: exercise.id, moduleId: '', title: '', instructions: '', updatedAt: '' },
      exercise.templateCode as TranslateType,
      exercise.content,
      exercise.expectedAnswers,
    );
    for (const item of document.items) itemsById.set(item.id, item);
  }

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
            <SubmissionCard exerciseId={exerciseId} entry={entry} itemsById={itemsById} />
          </li>
        ))}
      </ul>
    </div>
  );
}
