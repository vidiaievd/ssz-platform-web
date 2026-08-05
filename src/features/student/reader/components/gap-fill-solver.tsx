'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  useRevealAnswers,
  useStartAttempt,
  useSubmitAnswer,
} from '@/features/student/exercises/api/use-attempt';
import type {
  GapFillAttemptContent,
  GapFillSubmitDetails,
} from '@/features/student/exercises/types/attempts';
import {
  PRACTICE_ACCENT,
  WordBankGapFillBody,
  type GapFillValue,
  type GapVerdict,
} from '@/features/student/exercises/runner';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface GapFillSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** Fired once, on the first check — the honest signal for progress. */
  onChecked?: (ok: boolean) => void;
}

/**
 * `word_bank_gap_fill` played against the server.
 *
 * Deliberately not routed through `ExerciseSolver`'s shared path. The other twelve
 * templates fetch their answers and grade in the browser; this one cannot, because its
 * answers are the words missing from its sentences. Generalising the shared solver
 * around a single server-graded type would be designing the abstraction blind — when
 * the rest move over, their shape will be known.
 */
export function GapFillSolver({
  exerciseId,
  instruction,
  language,
  onChecked,
}: GapFillSolverProps) {
  const t = useTranslations('ExerciseRunner');

  const start = useStartAttempt(exerciseId);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [projection, setProjection] = useState<GapFillAttemptContent | null>(null);

  const submit = useSubmitAnswer(exerciseId, attemptId);
  const reveal = useRevealAnswers(exerciseId, attemptId);

  const [value, setValue] = useState<GapFillValue>({});
  const [allFilled, setAllFilled] = useState(false);
  const [results, setResults] = useState<Record<string, GapVerdict> | undefined>();
  const [revealed, setRevealed] = useState<Record<string, string> | undefined>();
  const [attempts, setAttempts] = useState(0);

  /**
   * Wall-clock since the attempt opened; the engine records it per submission. Set
   * when the attempt starts rather than at first render — reading the clock during
   * render is impure, and the two moments differ by however long the request took.
   */
  const openedAt = useRef(0);

  const startMutate = start.mutate;
  useEffect(() => {
    startMutate(
      { language },
      {
        onSuccess: (data) => {
          setAttemptId(data.attemptId);
          setProjection(data.exerciseContent as GapFillAttemptContent);
          openedAt.current = Date.now();
        },
      },
    );
  }, [startMutate, language]);

  const solved = useMemo(
    () => results !== undefined && Object.values(results).every((verdict) => verdict.correct),
    [results],
  );

  if (start.isPending || (start.isSuccess && projection === null)) {
    return <LearningSkeleton variant="list" rows={4} />;
  }
  if (start.isError || projection === null || attemptId === null) {
    return <ErrorState onRetry={() => startMutate({ language })} />;
  }

  function check() {
    const placements = Object.entries(value).map(([gapKey, word]) => ({ gapKey, word }));
    submit.mutate(
      {
        submittedAnswer: { placements },
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
      },
      {
        onSuccess: (data) => {
          const details = data.details as GapFillSubmitDetails | undefined;
          const byGap: Record<string, GapVerdict> = {};
          for (const gap of details?.gaps ?? []) {
            byGap[gap.gapKey] = { correct: gap.correct, explanation: gap.explanation };
          }
          setResults(byGap);
          // Progress follows the first attempt; later ones are practice.
          if (attempts === 0) onChecked?.(data.correct);
          setAttempts((n) => n + 1);
        },
      },
    );
  }

  function showAnswers() {
    reveal.mutate(undefined, {
      onSuccess: (data) => {
        const byGap: Record<string, string> = {};
        for (const answer of data.answers) byGap[answer.gapKey] = answer.word;
        setRevealed(byGap);
        setResults((current) => {
          if (current !== undefined) return current;
          // Revealing without having checked cannot happen through this UI, but if
          // it ever did, the blocks need something to render against.
          return Object.fromEntries(
            data.answers.map((a) => [a.gapKey, { correct: false, explanation: a.why }]),
          );
        });
      },
    });
  }

  const isRevealed = revealed !== undefined;
  const canCheck = allFilled && !submit.isPending && !isRevealed && !solved;

  return (
    <div>
      <WordBankGapFillBody
        projection={projection}
        {...(instruction === undefined ? {} : { instruction })}
        value={value}
        onValueChange={setValue}
        onAnswerChange={setAllFilled}
        phase={isRevealed || solved ? 'feedback' : 'answering'}
        mode="practice"
        accent={PRACTICE_ACCENT}
        {...(results === undefined ? {} : { results })}
        {...(revealed === undefined ? {} : { revealed })}
      />

      {submit.isError && (
        <p role="alert" className="mt-3 text-[13px] text-(--ssz-feedback-no-fg)">
          {t('gapFill.checkFailed')}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!isRevealed && !solved && (
          <button
            type="button"
            disabled={!canCheck}
            onClick={check}
            className="rounded-lg px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-40"
            style={{ background: PRACTICE_ACCENT }}
          >
            {submit.isPending
              ? t('gapFill.checking')
              : allFilled
                ? t('gapFill.check')
                : t('gapFill.fillEveryGap')}
          </button>
        )}

        {solved && (
          <p className="text-[14px] font-bold text-(--ssz-feedback-ok-fg)">
            {t('feedback.correct')}
          </p>
        )}

        {/* Never a consequence of being wrong — attempts are unlimited, and the
            answer arrives only because the learner asked for it. */}
        {results !== undefined && !solved && !isRevealed && (
          <button
            type="button"
            disabled={reveal.isPending}
            onClick={showAnswers}
            className="rounded-lg border px-4 py-2 text-[13.5px] font-semibold disabled:opacity-40"
            style={{ borderColor: PRACTICE_ACCENT, color: PRACTICE_ACCENT }}
          >
            {t('feedback.showAnswer')}
          </button>
        )}

        {attempts > 0 && !isRevealed && (
          <span className="text-[12.5px] text-(--ssz-text-muted)">
            {t('gapFill.attemptCount', { n: attempts })}
          </span>
        )}
      </div>
    </div>
  );
}
