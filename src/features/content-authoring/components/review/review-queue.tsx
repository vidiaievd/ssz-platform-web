'use client';

import { useTranslations } from 'next-intl';
import { Check, Inbox } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { useAuthoringExercise, useReviewQueue } from '@/features/content-authoring/api';
import {
  fromPersisted as errorCorrectionFromPersisted,
  TEMPLATE_CODE as ERROR_CORRECTION_TEMPLATE_CODE,
} from '@/lib/shared-kernel/error-correction';
import {
  fromPersisted as translateFromPersisted,
  isTranslateCode,
  type TranslateType,
} from '@/lib/shared-kernel/translate';

import { SubmissionCard, type AuthoredItem } from './submission-card';

/** The envelope is the exercise row's business; reading the sentences needs none of it. */
const NO_ENVELOPE = { id: '', moduleId: '', title: '', instructions: '', updatedAt: '' };

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
  // learner wrote and how it was judged. Each template is read by its own kernel and
  // reduced to the two fields this screen shows, so the card never learns either document.
  const itemsById = new Map<string, AuthoredItem>();
  if (exercise && isTranslateCode(exercise.templateCode)) {
    const document = translateFromPersisted(
      { ...NO_ENVELOPE, id: exercise.id },
      exercise.templateCode as TranslateType,
      exercise.content,
      exercise.expectedAnswers,
    );
    for (const item of document.items) {
      itemsById.set(item.id, { prompt: item.source, teacherNote: item.teacherNote });
    }
  } else if (exercise && exercise.templateCode === ERROR_CORRECTION_TEMPLATE_CODE) {
    const document = errorCorrectionFromPersisted(
      { ...NO_ENVELOPE, id: exercise.id },
      exercise.content,
      exercise.expectedAnswers,
    );
    // The faulty sentence, not the key: it is what the learner was looking at, and the
    // key is already in front of the teacher mistake by mistake.
    for (const item of document.items) {
      itemsById.set(item.id, { prompt: item.wrong, teacherNote: item.teacherNote });
    }
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
