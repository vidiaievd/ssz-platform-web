'use client';

import { useTranslations } from 'next-intl';
import { Check, ChevronRight, Inbox } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/lib/i18n/navigation';
import { useAuthoringExercise, useCourseReviewQueue } from '@/features/content-authoring/api';
import { readAuthoredItems } from '@/features/content-authoring/lib/authored-items';
import type { CourseExerciseRef } from '@/features/content-authoring/lib/collect-course-exercises';
import type { LearnerSummary, ReviewQueueEntry } from '@/features/content-authoring/types/review';

import { SubmissionCard } from './submission-card';

export interface CourseReviewInboxProps {
  containerId: string;
  /** Where the per-exercise queues live, so a group can hand the teacher off to one. */
  schoolSlug: string;
}

/**
 * Everything waiting on a teacher across a whole course.
 *
 * The per-exercise queue answers "what is waiting *here*", which is only useful to someone
 * who already suspects something is. This screen is the other question — the one a teacher
 * actually opens their morning with — and it is why the queue was worth building: work
 * that nobody knows is waiting gets marked late or never.
 *
 * Grouped by exercise rather than served as one flat list, because marking is done in
 * sittings: the same key, the same sentences and the same judgement carry across a group,
 * and interleaving two exercises means re-reading the assignment on every card.
 */
export function CourseReviewInbox({ containerId, schoolSlug }: CourseReviewInboxProps) {
  const t = useTranslations('Authoring');
  const { data: queue, isLoading, isError } = useCourseReviewQueue(containerId);

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
        {t('review.courseEmpty')}
      </p>
    );
  }

  // In the course's own order, so the inbox reads the way the course does — and so that
  // an exercise nobody has handed in yet simply does not appear.
  const byExercise = new Map<string, ReviewQueueEntry[]>();
  for (const entry of items) {
    const group = byExercise.get(entry.exerciseId);
    if (group) group.push(entry);
    else byExercise.set(entry.exerciseId, [entry]);
  }

  const groups = (queue?.exercises ?? []).flatMap((exercise) => {
    const entries = byExercise.get(exercise.exerciseId);
    return entries ? [{ exercise, entries }] : [];
  });

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-center gap-2 text-sm text-[var(--ssz-text-secondary)]">
        <Inbox className="size-4" aria-hidden />
        {t('review.waiting', { count: queue?.total ?? items.length })}
      </p>

      {groups.map(({ exercise, entries }) => (
        <ExerciseGroup
          key={exercise.exerciseId}
          exercise={exercise}
          entries={entries}
          learners={queue?.learners ?? {}}
          queueHref={`/school/${schoolSlug}/content/${containerId}/lessons/${exercise.itemId}/review`}
        />
      ))}
    </div>
  );
}

interface ExerciseGroupProps {
  exercise: CourseExerciseRef;
  entries: ReviewQueueEntry[];
  learners: Record<string, LearnerSummary>;
  queueHref: string;
}

/**
 * One exercise's share of the inbox.
 *
 * The exercise document is fetched here rather than with the queue: only exercises that
 * someone has actually handed in appear, so a course of two hundred exercises costs as
 * many requests as it has work waiting — usually a handful.
 */
function ExerciseGroup({ exercise, entries, learners, queueHref }: ExerciseGroupProps) {
  const t = useTranslations('Authoring');
  const { data: authored } = useAuthoringExercise(exercise.exerciseId);
  const itemsById = readAuthoredItems(authored);

  const place = [exercise.levelTitle, exercise.moduleTitle, exercise.sectionTitle].filter(
    (part): part is string => Boolean(part),
  );

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">{exercise.title ?? t('lessons.untitled')}</h2>
        {place.length > 0 && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {place.map((part, index) => (
              <span key={`${part}-${index}`} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="size-3" aria-hidden />}
                {part}
              </span>
            ))}
          </p>
        )}
        <span className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {t('review.waiting', { count: entries.length })}
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link href={queueHref}>{t('review.openQueue')}</Link>
        </Button>
      </header>

      <ul className="flex flex-col gap-4">
        {entries.map((entry) => (
          <li key={entry.attemptId}>
            <SubmissionCard
              exerciseId={entry.exerciseId}
              entry={entry}
              itemsById={itemsById}
              learner={learners[entry.userId]}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
