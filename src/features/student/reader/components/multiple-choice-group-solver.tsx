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
  MultipleChoiceGroupBody,
  PRACTICE_ACCENT,
  readMultipleChoiceGroupProjection,
  type MultipleChoiceGroupPhase,
} from '@/features/student/exercises/runner';
import type {
  MultipleChoiceGroupSubmitDetails,
  MultipleChoiceGroupSubmittedAnswer,
} from '@/features/student/exercises/types/attempts';
import type { StudentProjection } from '@/lib/shared-kernel/multiple-choice-group';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface MultipleChoiceGroupSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** Fired once, on the first check — the honest signal for progress. */
  onChecked?: (ok: boolean | null) => void;
  /** True when the table is one card in a stack of tasks rather than the whole screen. */
  stacked?: boolean;
}

/**
 * `multiple_choice_group` played against the server: the whole table, checked as one.
 *
 * Nothing on this screen knows which column is right. The table goes up and the verdict
 * comes down, dosed by how the table stands: a check reports which statements are wrong
 * and nothing more, and only a *closed* table carries the right column, the author's line
 * and the quote that proves it. That dosing is the type — a retry offered by a browser
 * already holding the key is decoration (plan 54 §3.2).
 *
 * A check is a `submit` of the whole attempt, and a re-check is another `submit` onto the
 * same one: the engine reopens a scored practice attempt for a further check and counts
 * them against the author's `retry` budget (plan 54 §3.3). Three of the four things that
 * decides are not sent from here at all — which check this is, which rows are frozen, and
 * what was picked the first time round are facts about the attempt, and the engine writes
 * its own over anything a client might put in their place. The fourth, `reveal`, is the
 * student's: «Vis fasit» closes the table with the score it already had.
 *
 * **A closed table is closed even with budget left.** All-right and «Vis fasit» leave
 * checks unspent, and the engine refuses a further check on either — so this runner must
 * not offer one. `closed` from the last verdict is what the buttons are drawn from,
 * never a count kept here.
 */
export function MultipleChoiceGroupSolver({
  exerciseId,
  instruction,
  language,
  onChecked,
  stacked = false,
}: MultipleChoiceGroupSolverProps) {
  const t = useTranslations('ExerciseRunner');

  const start = useStartAttempt(exerciseId);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [projection, setProjection] = useState<StudentProjection | null>(null);
  /** Set when the table arrived with its answer key still on it — see the projection reader. */
  const [unusable, setUnusable] = useState(false);

  const submit = useSubmitAnswer(exerciseId, attemptId);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<MultipleChoiceGroupPhase>('answering');
  const [verdict, setVerdict] = useState<MultipleChoiceGroupSubmitDetails | null>(null);
  /** Rows the server froze under `lockCorrect`. Cumulative, and it outlives the verdict. */
  const [locked, setLocked] = useState<string[]>([]);
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
          const table = readMultipleChoiceGroupProjection(data.exerciseContent);
          if (table === null) {
            setUnusable(true);
            return;
          }

          setAttemptId(data.attemptId);
          setProjection(table);
          setAnswers({});
          setPhase('answering');
          setVerdict(null);
          setLocked([]);
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

  if (!unusable && (start.isPending || (start.isSuccess && projection === null))) {
    return <LearningSkeleton variant="list" rows={4} />;
  }
  if (unusable || start.isError || projection === null || attemptId === null) {
    return <ErrorState onRetry={retryStart} />;
  }

  // The reader owns the instruction line — it is translated per learner, while the
  // projection carries the author's own, in the language being learned. One or the other,
  // never both above the table (precedent: plan 53 §5).
  const table =
    instruction === undefined || instruction === '' ? projection : { ...projection, instruction };

  /**
   * Hand the table in, or ask to be shown the key.
   *
   * The verdict decides everything that follows, including whether the table is over:
   * `closed` is the server's word. What is not sent is as deliberate as what is — see the
   * note on the component.
   */
  function send(reveal = false) {
    if (attemptId === null || submit.isPending) return;
    setError(null);

    const answer: MultipleChoiceGroupSubmittedAnswer = {
      answers,
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
          const details = data.details as MultipleChoiceGroupSubmitDetails | undefined;
          if (details === undefined || !Array.isArray(details.items)) {
            setError(t('multipleChoiceGroup.sendFailed'));
            return;
          }

          setVerdict(details);
          setLocked(details.locked);
          setPhase('checked');

          // Once, and on the first check: a corrected table is not evidence that the text
          // was understood, which is why the engine publishes its score event on the
          // first check alone (plan 54 §3.3).
          if (!reported.current) {
            reported.current = true;
            onChecked?.(data.requiresReview ? null : data.correct);
          }
        },
        onError: async (e) => {
          // A refusal the engine will keep making — this table is closed, the budget is
          // spent — reads the same to the learner as a lost request, but only one of them
          // is worth pressing the button again for.
          if (e instanceof AttemptRequestError && e.status === 422) {
            setError(t('multipleChoiceGroup.closedAlready'));
            return;
          }
          // The check may well have landed: the engine accepts a submission before it
          // scores it. Asking is the only way to tell a lost request from a lost response.
          const resolution = await resolveSubmitFailure(exerciseId, openAttemptId);
          setError(
            resolution === 'delivered'
              ? t('multipleChoiceGroup.closedAlready')
              : t('multipleChoiceGroup.sendFailed'),
          );
        },
      },
    );
  }

  /**
   * Tap a cell. One column per row: the pick replaces whatever that row held.
   *
   * A locked row is not editable, and neither is a table that has been checked — the
   * button that reopens it is «Prøv de feile igjen», not a tap.
   */
  function pick(rowId: string, columnId: string) {
    if (phase !== 'answering' || locked.includes(rowId)) return;
    setAnswers((current) => ({ ...current, [rowId]: columnId }));
  }

  /**
   * «Prøv de feile igjen» — R15. What survives the retry is decided from what the server
   * said, because the settings that decide it are not in the projection and must not be:
   * a client told `lockCorrect: false` could unfreeze rows the server froze.
   *
   * `locked` is the server's frozen set, which under `lockCorrect` is exactly the correct
   * rows and is otherwise empty. So: a non-empty freeze means the answers to keep are the
   * frozen ones; a freeze that is empty *while some row came out right* means the author
   * turned locking off, and S3.5 keeps every answer, wrong ones included. Nothing came out
   * right and nothing is frozen is the one case the two readings share — there is no
   * correct answer to keep either way — and the wrong picks are cleared, which is what the
   * button offers to do (plan 54 §5, deviation 8).
   */
  function retry() {
    const wasRight = (verdict?.items ?? []).some((item) => item.correct);
    const keepAll = locked.length === 0 && wasRight;

    if (!keepAll) {
      const kept: Record<string, string> = {};
      for (const rowId of locked) {
        const held = answers[rowId];
        if (held !== undefined) kept[rowId] = held;
      }
      setAnswers(kept);
    }

    setVerdict(null);
    setPhase('answering');
    setError(null);
  }

  /** Start the table over — a new attempt, not an edit of the closed one. */
  function restart() {
    reported.current = false;
    begin();
  }

  return (
    <div>
      <MultipleChoiceGroupBody
        projection={table}
        answers={answers}
        onPick={pick}
        phase={phase}
        verdict={verdict}
        locked={locked}
        sending={submit.isPending}
        error={error}
        onCheck={() => send()}
        onRetry={retry}
        onReveal={() => send(true)}
        onFinish={() => setPhase('done')}
        onRestart={restart}
        showProgressBar={!stacked}
        accent={PRACTICE_ACCENT}
      />
    </div>
  );
}
