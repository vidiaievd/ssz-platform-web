'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  AttemptRequestError,
  resolveSubmitFailure,
  useStartAttempt,
  useSubmitAnswer,
} from '@/features/student/exercises/api/use-attempt';
import {
  PRACTICE_ACCENT,
  readSortIntoBucketsProjection,
  SortIntoBucketsBody,
  type SortIntoBucketsPhase,
  type SortIntoBucketsPlacements,
} from '@/features/student/exercises/runner';
import type {
  SortIntoBucketsSubmitDetails,
  SortIntoBucketsSubmittedAnswer,
} from '@/features/student/exercises/types/attempts';
import type { StudentProjection } from '@/lib/shared-kernel/sort-into-buckets';
import { useExerciseAudio } from '@/features/student/exercises/audio';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface SortIntoBucketsSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** Fired once, on the first check — the honest signal for progress. */
  onChecked?: (ok: boolean | null) => void;
  /**
   * On the shared solver signature, unread: the board draws no progress bar of its own
   * (AC-S9), so there is nothing for a stack of tasks to take over.
   */
  stacked?: boolean;
}

/**
 * `sort_into_buckets` played against the server: the whole board, checked as one.
 *
 * Nothing on this screen knows which zone is right. The placements go up and the verdict
 * comes down, dosed by how the board stands: a check reports which tiles are wrong and why
 * the zone they chose is wrong, and only a *closed* board carries the right zone, each
 * zone's rule and each tile's reason (plan 66 §3.4). That dosing is the type — a retry
 * offered by a browser already holding the key is decoration.
 *
 * A check is a `submit` of every placement, and a re-check is another `submit` onto the
 * same attempt: the engine reopens a scored practice attempt and counts the checks against
 * the author's budget. Which check this is, which tiles are frozen and where each stood the
 * first time round are facts about the attempt, and the engine writes its own over anything
 * a client might put in their place — none of them is sent from here. `reveal` is the
 * student's: «Vis riktig plassering» closes the board and records the attempt as failed.
 *
 * Three things are held here that are not one thing:
 *
 *   * **`locked`** is the server's frozen set, and it outlives the verdict — a retry drops
 *     the marks and the explanations and keeps the freeze (plan 54's lesson).
 *   * **`verdict`** is the last check, and `null` between a retry and the next check.
 *   * **`attempt`** is the check the board is *on*, which a retry moves past the last one
 *     before the server has been asked anything.
 *
 * **A closed board is closed even with budget left.** All-right and «Vis riktig
 * plassering» leave checks unspent, and the engine refuses a further check on either — so
 * this runner must not offer one. `closed` from the last verdict is what the buttons are
 * drawn from, never a count kept here.
 */
export function SortIntoBucketsSolver({
  exerciseId,
  instruction,
  language,
  onChecked,
}: SortIntoBucketsSolverProps) {
  const t = useTranslations('ExerciseRunner.sortIntoBuckets');

  const start = useStartAttempt(exerciseId);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [projection, setProjection] = useState<StudentProjection | null>(null);
  /**
   * The document as the engine dealt it, kept for the audio layer alone: the projection
   * is the kernel's own shape and has no room for a block that is not the template's
   * (plan 56).
   */
  const [document, setDocument] = useState<unknown>(null);
  /** What the clip said, once the engine hands it over with the closing verdict. */
  const [transcript, setTranscript] = useState<{ transcript: string; translation: string } | null>(
    null,
  );
  /** Set when the board arrived with its answer key still on it — see the projection reader. */
  const [unusable, setUnusable] = useState(false);

  const submit = useSubmitAnswer(exerciseId, attemptId);

  const [placements, setPlacements] = useState<SortIntoBucketsPlacements>({});
  const [phase, setPhase] = useState<SortIntoBucketsPhase>('answering');
  const [verdict, setVerdict] = useState<SortIntoBucketsSubmitDetails | null>(null);
  const [locked, setLocked] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(1);
  const [error, setError] = useState<string | null>(null);

  /** Wall-clock since the attempt opened; the engine records it per submission. */
  const openedAt = useRef(0);
  /** So progress is reported for the first check only — the one the SRS is built on. */
  const reported = useRef(false);

  const startMutate = start.mutate;
  const begin = useCallback(() => {
    startMutate(
      { language },
      {
        onSuccess: (data) => {
          const board = readSortIntoBucketsProjection(data.exerciseContent);
          if (board === null) {
            setUnusable(true);
            return;
          }

          setAttemptId(data.attemptId);
          setProjection(board);
          setDocument(data.exerciseContent);
          setTranscript(null);
          setPlacements({});
          setPhase('answering');
          setVerdict(null);
          setLocked([]);
          setAttempt(1);
          setError(null);
          openedAt.current = Date.now();
        },
      },
    );
  }, [startMutate, language]);

  useEffect(() => {
    begin();
  }, [begin]);

  const retryStart = useCallback(() => {
    setUnusable(false);
    begin();
  }, [begin]);

  /**
   * The listening layer, mounted once for the whole board rather than per tile: the
   * allowance, the gate and the playthrough belong to the exercise.
   */
  const audio = useExerciseAudio(document);

  if (!unusable && (start.isPending || (start.isSuccess && projection === null))) {
    return <LearningSkeleton variant="list" rows={4} />;
  }
  if (unusable || start.isError || projection === null || attemptId === null) {
    return <ErrorState onRetry={retryStart} />;
  }

  // The reader owns the instruction line — it is translated per learner, while the
  // projection carries the author's own, in the language being learned. One or the other,
  // never both above the board (precedent: plan 53 §5).
  const shown =
    instruction === undefined || instruction === '' ? projection.instruction : instruction;

  /**
   * Hand the board in, or ask to be shown the key.
   *
   * Every placement goes, frozen tiles included: the server ignores a move of a tile it
   * froze, and sending only the new ones would make a check depend on what this component
   * remembers rather than on what the board says.
   */
  function send(reveal = false) {
    if (attemptId === null || submit.isPending) return;
    setError(null);

    const answer: SortIntoBucketsSubmittedAnswer = {
      placements: Object.entries(placements).map(([itemId, bucketId]) => ({ itemId, bucketId })),
      ...(reveal ? { reveal: true } : {}),
    };
    const openAttemptId = attemptId;

    submit.mutate(
      {
        submittedAnswer: answer,
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
      },
      {
        onSuccess: (data) => {
          const details = data.details as SortIntoBucketsSubmitDetails | undefined;
          if (details === undefined || !Array.isArray(details.items)) {
            setError(t('sendFailed'));
            return;
          }

          setVerdict(details);
          setLocked(details.locked);
          setAttempt(details.attempt);
          setPhase('checked');
          if (data.audioTranscript !== undefined) setTranscript(data.audioTranscript);

          // Once, and on the first check: a corrected board is not evidence that the
          // distinction was understood, which is why the engine publishes its score event
          // on the first check alone.
          if (!reported.current) {
            reported.current = true;
            onChecked?.(data.requiresReview ? null : data.correct);
          }
        },
        onError: async (e) => {
          // A refusal the engine will keep making — this board is closed, the budget is
          // spent — reads the same to the learner as a lost request, but only one of them
          // is worth pressing the button again for.
          if (e instanceof AttemptRequestError && e.status === 422) {
            setError(t('closedAlready'));
            return;
          }
          // The check may well have landed: the engine accepts a submission before it
          // scores it. Asking is the only way to tell a lost request from a lost response.
          const resolution = await resolveSubmitFailure(exerciseId, openAttemptId);
          setError(resolution === 'delivered' ? t('closedAlready') : t('sendFailed'));
        },
      },
    );
  }

  /** Put a tile in a zone, or back in the pool. A frozen tile is not the student's to move. */
  function place(itemId: string, bucketId: string | null) {
    if (locked.includes(itemId)) return;
    setPlacements((current) => {
      const next = { ...current };
      if (bucketId === null) delete next[itemId];
      else next[itemId] = bucketId;
      return next;
    });
  }

  /**
   * «Prøv de feile på nytt» — exactly the tiles the last check found wrong go back to the
   * pool (AC-S5). Frozen tiles stay; so does a tile placed since the check and not yet
   * checked, which was neither right nor wrong and is the student's work in progress.
   * The check the board is on moves past the one that was just made.
   */
  function retry() {
    if (verdict === null) return;

    const wrong = new Set(
      verdict.items
        .filter((item) => !item.correct && item.chosenBucketId !== null)
        .filter((item) => placements[item.itemId] === item.chosenBucketId)
        .map((item) => item.itemId),
    );
    setPlacements((current) => {
      const next: SortIntoBucketsPlacements = {};
      for (const [itemId, bucketId] of Object.entries(current)) {
        if (!wrong.has(itemId) || locked.includes(itemId)) next[itemId] = bucketId;
      }
      return next;
    });

    setAttempt(verdict.attempt + 1);
    setVerdict(null);
    setPhase('answering');
    setError(null);
  }

  /** Start the board over — a new attempt, not an edit of the closed one. */
  function restart() {
    reported.current = false;
    begin();
  }

  return (
    <div>
      <SortIntoBucketsBody
        projection={projection}
        instruction={shown}
        placements={placements}
        onPlace={place}
        phase={phase}
        verdict={verdict}
        locked={locked}
        attempt={attempt}
        sending={submit.isPending}
        error={error}
        onCheck={() => send()}
        onRetry={retry}
        onReveal={() => send(true)}
        onFinish={() => setPhase('done')}
        onRestart={restart}
        accent={PRACTICE_ACCENT}
        audio={audio}
        audioTranscript={transcript}
      />
    </div>
  );
}
