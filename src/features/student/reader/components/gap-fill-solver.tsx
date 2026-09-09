'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  fetchLastAttempt,
  useRevealAnswers,
  useStartAttempt,
  useSubmitAnswer,
} from '@/features/student/exercises/api/use-attempt';
import type {
  GapFillAttemptContent,
  GapFillSubmitDetails,
  GapFillSubmittedAnswer,
} from '@/features/student/exercises/types/attempts';
import {
  PRACTICE_ACCENT,
  WordBankGapFillBody,
  type GapFillValue,
  type GapVerdict,
} from '@/features/student/exercises/runner';
import { useExerciseAudio } from '@/features/student/exercises/audio';
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
  /** What the clip said, once the engine hands it over with the verdicts. */
  const [transcript, setTranscript] = useState<{ transcript: string; translation: string } | null>(
    null,
  );

  /**
   * The listening layer, read off the projected document — the block rides with it, so
   * there is nothing else to fetch and nothing to keep in step (plan 56).
   */
  const audio = useExerciseAudio(projection);

  const submit = useSubmitAnswer(exerciseId, attemptId);
  const reveal = useRevealAnswers(exerciseId, attemptId);

  const [value, setValue] = useState<GapFillValue>({});
  const [allFilled, setAllFilled] = useState(false);
  const [results, setResults] = useState<Record<string, GapVerdict> | undefined>();
  const [revealed, setRevealed] = useState<Record<string, string> | undefined>();
  const [attempts, setAttempts] = useState(0);

  /**
   * The server's verdict on the whole exercise, not a conclusion drawn from the
   * verdicts still on screen. Those are a working set: the retry drops the wrong ones
   * and keeps the correct ones to hold their locks, and reading "every verdict here is
   * correct" off that would declare the exercise solved the moment the wrong gaps were
   * emptied — with the gaps then frozen and no way to answer them.
   */
  const [solved, setSolved] = useState(false);

  /**
   * The answer from last time, once it has been put back in the gaps — carrying when it
   * was saved, which is the only part of it not already on screen.
   *
   * The engine has kept every submission all along; nothing ever read them back, so
   * returning to a solved exercise showed empty gaps and the work looked undone.
   */
  const [restored, setRestored] = useState<{ at: string | null } | null>(null);

  /**
   * Whether the saved answer has had its one chance to appear. It is restored as part
   * of opening the attempt — the sentences arrive with the attempt, and until they do
   * there is nowhere to put it — and never again after that: the screen then belongs to
   * the learner, and painting an old answer over what they are typing, or back over the
   * clean start they just asked for, would be the opposite of restoring it.
   */
  const restoreConsidered = useRef(false);

  /**
   * Wall-clock since the attempt opened; the engine records it per submission. Set
   * when the attempt starts rather than at first render — reading the clock during
   * render is impure, and the two moments differ by however long the request took.
   */
  const openedAt = useRef(0);

  /**
   * Opening the attempt, on mount and on retry alike. It has to be one function: the
   * projection only ever arrives through this callback, so a retry that called `mutate`
   * without it would leave the mutation successful and the projection null — which the
   * guard below reads as "still loading", and the exercise never appears again.
   */
  const startMutate = start.mutate;
  const begin = useCallback(() => {
    startMutate(
      { language },
      {
        onSuccess: async (data) => {
          setAttemptId(data.attemptId);
          setProjection(data.exerciseContent as GapFillAttemptContent);
          setTranscript(null);
          openedAt.current = Date.now();

          if (restoreConsidered.current) return;
          restoreConsidered.current = true;

          const saved = await fetchLastAttempt(exerciseId);
          const placements = (saved?.submittedAnswer as GapFillSubmittedAnswer | null)?.placements;
          if (saved === null || !Array.isArray(placements) || placements.length === 0) return;

          const details = saved.validationDetails as GapFillSubmitDetails | null;
          const byGap: Record<string, GapVerdict> = {};
          for (const gap of details?.gaps ?? []) {
            byGap[gap.gapKey] = { correct: gap.correct, explanation: gap.explanation };
          }

          setValue(Object.fromEntries(placements.map((p) => [p.gapKey, p.word])));
          if (Object.keys(byGap).length > 0) setResults(byGap);
          setSolved(saved.score === 100);
          setRestored({ at: saved.submittedAt ?? saved.scoredAt });
        },
      },
    );
  }, [startMutate, language, exerciseId]);

  useEffect(() => {
    begin();
  }, [begin]);

  /**
   * Whether the learner is reading a check or answering again. The feedback belongs to
   * the check that produced it: once they go back to the gaps, a block still explaining
   * a gap that is already right and locked is just something left on the screen.
   */
  const [reading, setReading] = useState(false);

  /**
   * Pointing out the gaps that are still empty, after the learner presses the primary
   * action too early. It runs out on its own: an empty gap is not an error — it is work
   * not done yet — and a marking that stayed would say otherwise for the rest of the
   * exercise. The timer lives here because the press does.
   */
  const [pointOut, setPointOut] = useState(false);
  const pointOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pointOutTimer.current !== null) clearTimeout(pointOutTimer.current);
    },
    [],
  );

  if (start.isPending || (start.isSuccess && projection === null)) {
    return <LearningSkeleton variant="list" rows={4} />;
  }
  if (start.isError || projection === null || attemptId === null) {
    return <ErrorState onRetry={begin} />;
  }

  function showEmptyGaps() {
    if (pointOutTimer.current !== null) clearTimeout(pointOutTimer.current);
    setPointOut(true);
    pointOutTimer.current = setTimeout(() => setPointOut(false), 2000);
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
          // The answers are in, so the clip has nothing left to give away.
          if (data.audioTranscript !== undefined) setTranscript(data.audioTranscript);
          setSolved(data.correct);
          setReading(true);
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
        // The reveal payload is discriminated by template — `match_pairs` reveals
        // slots, not gaps — and this solver only ever asks about its own exercise.
        if (data.templateCode !== 'word_bank_gap_fill') return;
        const byGap: Record<string, string> = {};
        for (const answer of data.answers) byGap[answer.gapKey] = answer.word;
        setRevealed(byGap);
        // The answers are in the sentences, which is where they mean something, so
        // the per-gap blocks stay closed. The teacher's note is not thrown away with
        // them: it rides along as the gap's explanation, and the body offers it on
        // the marker beside the answer. (AC-S12 asks for `answer — why` in a block;
        // this is the same two facts, one of them on request.)
        setReading(false);
        setResults((current) =>
          Object.fromEntries(
            data.answers.map((a) => [
              a.gapKey,
              { correct: current?.[a.gapKey]?.correct ?? false, explanation: a.why },
            ]),
          ),
        );
      },
    });
  }

  /**
   * Back to editing after a check (AC-S10). The gaps that were wrong are emptied —
   * re-reading your own wrong word is how you talk yourself into it a second time —
   * while the correct ones keep their verdict and stay locked, because that verdict is
   * the only thing holding the lock.
   */
  function fixAnswers() {
    const nextValue = { ...value };
    const kept: Record<string, GapVerdict> = {};
    for (const [gapKey, verdict] of Object.entries(results ?? {})) {
      if (verdict.correct) kept[gapKey] = verdict;
      else delete nextValue[gapKey];
    }
    setValue(nextValue);
    setResults(Object.keys(kept).length > 0 ? kept : undefined);
    setReading(false);
    setRestored(null);
  }

  /**
   * Clearing a restored answer to write a new one. No new attempt is needed: the one
   * opened on mount was never submitted — the old answer was only ever painted onto it —
   * so this drops the paint and leaves the attempt to be used as normal.
   */
  function answerAgain() {
    setValue({});
    setResults(undefined);
    setSolved(false);
    setReading(false);
    setRestored(null);
  }

  /**
   * A clean run at the exercise. The reveal closed the attempt server-side, so this is
   * a new attempt rather than a reset of the old one — everything the learner did is
   * dropped along with the answers they were shown.
   */
  function restart() {
    setValue({});
    setResults(undefined);
    setRevealed(undefined);
    setSolved(false);
    setReading(false);
    setRestored(null);
    setAttempts(0);
    setAttemptId(null);
    setProjection(null);
    begin();
  }

  const isRevealed = revealed !== undefined;
  /**
   * A check the learner has not answered yet. While one is on screen the primary
   * action is to correct it, not to check the same words again — so `Check` gives
   * way to `Try again` until the wrong gaps are cleared.
   */
  const hasWrong =
    results !== undefined && Object.values(results).some((verdict) => !verdict.correct);
  const canCheck = allFilled && !submit.isPending && !isRevealed && !solved;

  const restoredCounts =
    restored === null || results === undefined
      ? null
      : {
          correct: Object.values(results).filter((verdict) => verdict.correct).length,
          total: Object.keys(results).length,
        };

  return (
    <div>
      {restored !== null && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-subtle px-4 py-3">
          <div className="text-[13px] text-(--ssz-text-secondary)">
            <span className="font-semibold text-(--ssz-text-primary)">
              {t('gapFill.restored', {
                date:
                  restored.at === null
                    ? ''
                    : new Intl.DateTimeFormat(undefined, {
                        dateStyle: 'medium',
                      }).format(new Date(restored.at)),
              })}
            </span>
            {restoredCounts !== null && (
              <span className="ml-2">{t('gapFill.restoredScored', restoredCounts)}</span>
            )}
          </div>
          <button
            type="button"
            onClick={answerAgain}
            className="rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold"
            style={{ borderColor: PRACTICE_ACCENT, color: PRACTICE_ACCENT }}
          >
            {t('gapFill.startOver')}
          </button>
        </div>
      )}

      <WordBankGapFillBody
        projection={projection}
        audio={audio}
        audioTranscript={transcript}
        {...(instruction === undefined ? {} : { instruction })}
        value={value}
        onValueChange={setValue}
        onAnswerChange={setAllFilled}
        phase={isRevealed || solved ? 'feedback' : 'answering'}
        mode="practice"
        accent={PRACTICE_ACCENT}
        showFeedback={reading}
        pointOut={pointOut}
        {...(results === undefined ? {} : { results })}
        {...(revealed === undefined ? {} : { revealed })}
      />

      {submit.isError && (
        <p role="alert" className="mt-3 text-[13px] text-(--ssz-feedback-no-fg)">
          {t('gapFill.checkFailed')}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!isRevealed && !solved && !hasWrong && (
          <button
            type="button"
            // `aria-disabled` rather than `disabled`: the button still reads as
            // unavailable and still refuses to check, but it stays reachable — and a
            // press on it is the one moment we know the learner is looking for what
            // is missing, which is when the empty gaps are worth pointing out.
            aria-disabled={!canCheck}
            onClick={() => {
              if (submit.isPending) return;
              if (allFilled) check();
              else showEmptyGaps();
            }}
            className="rounded-lg px-4 py-2 text-[13.5px] font-semibold text-white aria-disabled:opacity-40"
            style={{ background: PRACTICE_ACCENT }}
          >
            {submit.isPending
              ? t('gapFill.checking')
              : allFilled
                ? t('gapFill.check')
                : t('gapFill.fillEveryGap')}
          </button>
        )}

        {/* AC-S10. The count rides on the button because that is what advances it:
            this is the learner starting attempt n+1, not a tally of the past. */}
        {hasWrong && !isRevealed && (
          <button
            type="button"
            onClick={fixAnswers}
            className="rounded-lg px-4 py-2 text-[13.5px] font-semibold text-white"
            style={{ background: PRACTICE_ACCENT }}
          >
            {t('gapFill.retryAttempt', { n: attempts + 1 })}
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

        {/* AC-S12: after the reveal the only thing left to do is run it again from
            scratch. Without this the exercise simply ends on a screen of answers. */}
        {isRevealed && (
          <button
            type="button"
            disabled={start.isPending}
            onClick={restart}
            className="rounded-lg px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-40"
            style={{ background: PRACTICE_ACCENT }}
          >
            {t('gapFill.restart')}
          </button>
        )}

        {reveal.isError && (
          <p role="alert" className="text-[13px] text-(--ssz-feedback-no-fg)">
            {t('gapFill.revealFailed')}
          </p>
        )}

        {/* While the learner is editing there is nothing to count yet: the number
            they care about is on the button that starts the next attempt. */}
        {attempts > 0 && !isRevealed && !hasWrong && !solved && (
          <span className="text-[12.5px] text-(--ssz-text-muted)">
            {t('gapFill.attemptCount', { n: attempts + 1 })}
          </span>
        )}
      </div>
    </div>
  );
}
