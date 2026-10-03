'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Shuffle as ShuffleIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  check,
  toContent,
  toExpectedAnswers,
  toStudentProjection,
  type CheckResult,
  type SortIntoBucketsContent,
} from '@/lib/shared-kernel/sort-into-buckets';
import {
  SortIntoBucketsBody,
  type SortIntoBucketsPhase,
} from '@/features/student/exercises/runner/sort-into-buckets-body';
import { PRACTICE_ACCENT } from '@/features/student/exercises/runner/types';
import type { SortIntoBucketsSubmitDetails } from '@/features/student/exercises/types/attempts';

export interface SortIntoBucketsPreviewProps {
  exercise: SortIntoBucketsContent;
}

/**
 * The student's view of the board the teacher is building — the actual runner body, not a
 * lookalike (AC-X10). It goes through `toStudentProjection`, which is what takes the key
 * away, drops the unfinished items and deals the order, so the panel answers the question
 * an author really has: what is my student handed?
 *
 * **The verdict is real.** It runs the kernel's own `check`, the function the engine calls.
 * The teacher owns the key, so judging in their browser reveals nothing to anybody — and it
 * is the only way to see what a wrong bucket is told, which tiles freeze and when the board
 * closes. It is not an attempt: nothing is recorded and no score leaves this component.
 *
 * The panel is narrow, so the body's own width switch draws the phone layout here.
 */
export function SortIntoBucketsPreview({ exercise }: SortIntoBucketsPreviewProps) {
  const t = useTranslations('Authoring.sortIntoBuckets.preview');

  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<SortIntoBucketsPhase>('answering');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [locked, setLocked] = useState<string[]>([]);
  const [firstBuckets, setFirstBuckets] = useState<Record<string, string | null>>({});
  const [attempt, setAttempt] = useState(1);
  /** Bumped by the reshuffle button; nothing else may re-deal the tiles. */
  const [seed, setSeed] = useState(1);

  // Seeded, not random: this panel re-renders on every keystroke in the editor column, and a
  // `Math.random` shuffle would deal the tiles again on each one.
  const projection = useMemo(
    () => toStudentProjection(toContent(exercise), toExpectedAnswers(exercise), shuffleWith(seed)),
    [exercise, seed],
  );

  /*
    When the board changes under the runner the attempt starts again — during render, not
    in an effect, so there is no frame of a judged board against tiles that just changed.
    The signature covers what the tiles and zones are and the settings that decide what a
    check may do.
  */
  const signature = [
    projection.items.map((item) => item.id).join(','),
    projection.buckets.map((bucket) => bucket.id).join(','),
    exercise.settings.attempts,
    String(exercise.settings.revealKey),
    exercise.settings.threshold,
  ].join('|');
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    restart();
  }

  function restart() {
    setPlacements({});
    setResult(null);
    setLocked([]);
    setFirstBuckets({});
    setAttempt(1);
    setPhase('answering');
  }

  const send = (reveal = false) => {
    const verdict = check({
      ex: exercise,
      placements: Object.entries(placements).map(([itemId, bucketId]) => ({ itemId, bucketId })),
      attempt,
      reveal,
      locked,
      firstBuckets,
    });
    setFirstBuckets(verdict.firstBuckets);
    setResult(verdict);
    setLocked(verdict.locked);
    setPhase('checked');
  };

  const retry = () => {
    // The wrong tiles go back to the pool; the frozen ones stay where they are.
    setPlacements((current) =>
      Object.fromEntries(Object.entries(current).filter(([itemId]) => locked.includes(itemId))),
    );
    setResult(null);
    setAttempt(attempt + 1);
    setPhase('answering');
  };

  if (projection.items.length === 0) {
    return <p className="p-4 text-center text-sm text-muted-foreground">{t('empty')}</p>;
  }

  const details: SortIntoBucketsSubmitDetails | null =
    result === null
      ? null
      : {
          totalItems: result.total,
          passedItems: result.correct,
          correctNow: result.correctNow,
          attempt: result.attempt,
          checksLeft: result.checksLeft,
          closed: result.closed,
          revealed: result.revealed,
          locked: result.locked,
          rules: result.rules,
          items: result.items.map((item) => ({
            itemId: item.itemKey,
            chosenBucketId: item.chosenBucketId,
            correct: item.ok,
            firstCorrect: item.firstOk,
            firstAnswer: result.firstBuckets[item.itemKey] ?? null,
            ...(item.explanation === undefined ? {} : { explanation: item.explanation }),
            ...(item.correctBucketId === undefined
              ? {}
              : { correctBucketId: item.correctBucketId }),
            ...(item.why === undefined ? {} : { why: item.why }),
          })),
        };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <SortIntoBucketsBody
        projection={projection}
        placements={placements}
        // Functionally: two placements in the same tick must not lose the first.
        onPlace={(itemId, bucketId) =>
          setPlacements((current) => {
            const next = { ...current };
            if (bucketId === null) delete next[itemId];
            else next[itemId] = bucketId;
            return next;
          })
        }
        phase={phase}
        verdict={details}
        locked={locked}
        attempt={attempt}
        interactive
        onCheck={() => send()}
        onRetry={retry}
        onReveal={() => send(true)}
        onFinish={() => setPhase('done')}
        onRestart={restart}
        accent={PRACTICE_ACCENT}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{t('live')}</p>
        {exercise.settings.shuffle && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setSeed(seed + 1)}>
            <ShuffleIcon className="size-3.5" aria-hidden />
            {t('reshuffle')}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Deterministic, so the tiles hold still between keystrokes; quality is irrelevant. */
function shuffleWith(seed: number) {
  return <T,>(items: readonly T[]): T[] => {
    let state = seed * 2654435761;
    const next = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };
}
