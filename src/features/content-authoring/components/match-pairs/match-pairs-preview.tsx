'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  shuffled,
  toStudentProjection,
  type MatchPairs,
  type PairId,
  type RightId,
} from '@/lib/shared-kernel/match-pairs';
import { MatchPairsBody } from '@/features/student/exercises/runner';
import { PRACTICE_ACCENT } from '@/features/student/exercises/runner/types';

export interface MatchPairsPreviewProps {
  exercise: MatchPairs;
  instructions: string;
}

/**
 * The student's view of what the teacher is building — the actual runner body, not a
 * lookalike. A second rendering of the same document would be a second thing to keep in
 * step, and the first time it drifted the preview would be lying about the product.
 *
 * Two deliberate differences from a real attempt. The pool is not shuffled, because a
 * preview that reorders itself on every keystroke is unreadable while typing (AC-B29).
 * And there is no check: grading happens on the server against an attempt, which a
 * preview does not have — so placing halves is live, and the verdict is the one thing
 * this cannot show.
 */
export function MatchPairsPreview({ exercise, instructions }: MatchPairsPreviewProps) {
  const t = useTranslations('Authoring');
  const [placements, setPlacements] = useState<Record<PairId, RightId>>({});
  const seed = useMemo(() => seedFrom(exercise.id), [exercise.id]);

  const projection = useMemo(
    () =>
      toStudentProjection(
        {
          variant: exercise.variant,
          settings: exercise.settings,
          pairs: exercise.pairs,
          distractors: exercise.distractors,
        },
        // Seeded from the exercise, so the pool is mixed the way a student would see it
        // and stays put between keystrokes (AC-B29). A student's order comes from the
        // server's CSPRNG; this one only has to be stable.
        { shuffle: (pool) => shuffled(pool, seed) },
      ),
    [exercise.variant, exercise.settings, exercise.pairs, exercise.distractors, seed],
  );

  if (projection.slots.length === 0) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        {t('matchPairs.preview.empty')}
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <MatchPairsBody
        projection={projection}
        instruction={instructions}
        value={placements}
        onValueChange={setPlacements}
        onAnswerChange={() => {}}
        phase="answering"
        mode="practice"
        accent={PRACTICE_ACCENT}
      />
      <p className="text-center text-[11px] text-muted-foreground">
        {t('matchPairs.preview.noCheck')}
      </p>
    </div>
  );
}

/** A stable number from the exercise id — the preview's shuffle has to be repeatable. */
function seedFrom(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}
