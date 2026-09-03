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
  MatchPairsAttemptContent,
  MatchPairsSubmitDetails,
  MatchPairsSubmittedAnswer,
} from '@/features/student/exercises/types/attempts';
import {
  MatchPairsBody,
  PRACTICE_ACCENT,
  type MatchPairsValue,
  type RevealedSlot,
  type SlotVerdict,
} from '@/features/student/exercises/runner';
import { useExerciseAudio } from '@/features/student/exercises/audio';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface MatchPairsSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** Fired once, on the first check — the honest signal for progress. */
  onChecked?: (ok: boolean) => void;
}

/**
 * `match_pairs` played against the server.
 *
 * The second template to move off browser grading, and for the same reason as the
 * first: a pair is stored whole, so the answer to "which half completes this line" is
 * the neighbouring field. The old solver was handed `expectedAnswers.pairs` and graded
 * locally, which put the whole mapping in the DOM before the first attempt.
 *
 * Structured after `GapFillSolver` deliberately — same attempt lifecycle, same
 * unlimited attempts, same reveal-only-if-asked. The two are not yet folded into one
 * shared driver: the third server-graded template will say which parts are actually
 * common, and generalising over two is guessing.
 */
export function MatchPairsSolver({
  exerciseId,
  instruction,
  language,
  onChecked,
}: MatchPairsSolverProps) {
  const t = useTranslations('ExerciseRunner');

  const start = useStartAttempt(exerciseId);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [projection, setProjection] = useState<MatchPairsAttemptContent | null>(null);
  /** What the clip said, once the engine hands it over with the verdicts. */
  const [transcript, setTranscript] = useState<{ transcript: string; translation: string } | null>(
    null,
  );

  /**
   * The listening layer, read off the projected document — the block rides with it, so
   * there is nothing else to fetch and nothing to keep in step (plan 56 phase 6).
   */
  const audio = useExerciseAudio(projection);

  const submit = useSubmitAnswer(exerciseId, attemptId);
  const reveal = useRevealAnswers(exerciseId, attemptId);

  const [value, setValue] = useState<MatchPairsValue>({});
  const [canCheck, setCanCheck] = useState(false);
  const [results, setResults] = useState<Record<string, SlotVerdict> | undefined>();
  const [revealed, setRevealed] = useState<Record<string, RevealedSlot> | undefined>();
  const [attempts, setAttempts] = useState(0);
  /** The last check's tally, for the footnote `Attempt N · X of M correct`. */
  const [tally, setTally] = useState<{ correct: number; total: number } | null>(null);

  /**
   * The server's verdict on the whole exercise, not a conclusion drawn from the
   * verdicts on screen. Those are a working set — the retry drops the wrong ones and
   * keeps the correct ones to hold their locks — and reading "everything here is
   * correct" off it would declare the exercise solved the moment the wrong slots were
   * emptied, with the rest frozen and no way to answer them.
   */
  const [solved, setSolved] = useState(false);

  /** The answer from last time, once it is back in the slots, and when it was saved. */
  const [restored, setRestored] = useState<{ at: string | null } | null>(null);
  const restoreConsidered = useRef(false);
  const openedAt = useRef(0);

  const startMutate = start.mutate;
  const begin = useCallback(() => {
    startMutate(
      { language },
      {
        onSuccess: async (data) => {
          setAttemptId(data.attemptId);
          setProjection(data.exerciseContent as MatchPairsAttemptContent);
          setTranscript(null);
          openedAt.current = Date.now();

          if (restoreConsidered.current) return;
          restoreConsidered.current = true;

          const saved = await fetchLastAttempt(exerciseId);
          const placements = (saved?.submittedAnswer as MatchPairsSubmittedAnswer | null)
            ?.placements;
          if (saved === null || !Array.isArray(placements) || placements.length === 0) return;

          const details = saved.validationDetails as MatchPairsSubmitDetails | null;
          const bySlot: Record<string, SlotVerdict> = {};
          for (const pair of details?.pairs ?? []) {
            bySlot[pair.pairId] = { correct: pair.correct, explanation: pair.explanation };
          }

          setValue(Object.fromEntries(placements.map((p) => [p.pairId, p.rightId])));
          if (Object.keys(bySlot).length > 0) setResults(bySlot);
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
   * One slot's mark, dropped because the learner just edited that slot (AC-S11). Only
   * that one: the other marks belong to slots that have not been touched since the
   * check, and clearing them would throw away the locks holding the correct ones.
   */
  const clearMark = useCallback((slotId: string) => {
    setResults((current) => {
      if (current === undefined || current[slotId] === undefined) return current;
      const next = { ...current };
      delete next[slotId];
      return Object.keys(next).length > 0 ? next : undefined;
    });
  }, []);

  /** Whether the learner is reading a check or matching again. */
  const [reading, setReading] = useState(false);

  /**
   * Pointing out that nothing has been matched yet, after the learner presses the
   * primary action too early. It runs out on its own: an empty slot is work not done,
   * not an error, and a marking that stayed would say otherwise for the rest of the
   * exercise.
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

  function showEmptySlots() {
    if (pointOutTimer.current !== null) clearTimeout(pointOutTimer.current);
    setPointOut(true);
    pointOutTimer.current = setTimeout(() => setPointOut(false), 2000);
  }

  /**
   * Partial checking, which is the point of the type (AC-S7): three of five matched is
   * worth checking, and the three verdicts are what tells the learner whether their
   * reading of the grammar holds. The slots left empty are simply not sent — the
   * server scores them as unanswered rather than wrong.
   */
  function check() {
    const placements = Object.entries(value).map(([pairId, rightId]) => ({ pairId, rightId }));
    submit.mutate(
      {
        submittedAnswer: { placements },
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
      },
      {
        onSuccess: (data) => {
          const details = data.details as MatchPairsSubmitDetails | undefined;
          const bySlot: Record<string, SlotVerdict> = {};
          for (const pair of details?.pairs ?? []) {
            bySlot[pair.pairId] = { correct: pair.correct, explanation: pair.explanation };
          }
          setResults(bySlot);
          // The pairs are checked, so the clip has nothing left to give away.
          if (data.audioTranscript !== undefined) setTranscript(data.audioTranscript);
          if (details !== undefined) {
            setTally({ correct: details.correctPairs, total: details.totalPairs });
          }
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
        // Discriminated by template on the wire; this solver asks only about its own.
        if (data.templateCode !== 'match_pairs') return;
        const bySlot: Record<string, RevealedSlot> = {};
        for (const answer of data.answers) {
          bySlot[answer.pairId] = {
            rightId: answer.rightId,
            text: answer.text,
            why: answer.why,
          };
        }
        setRevealed(bySlot);
        // The halves are now in their slots, where they mean something; the per-slot
        // explanation blocks close, and the teacher's `why` takes their place.
        setReading(false);
      },
    });
  }

  /**
   * Back to matching after a check (AC-S10). The slots that were wrong give their
   * halves back — re-reading your own wrong pairing is how you talk yourself into it a
   * second time — while the correct ones keep their verdict and stay locked, because
   * that verdict is the only thing holding the lock.
   */
  function fixAnswers() {
    const nextValue = { ...value };
    const kept: Record<string, SlotVerdict> = {};
    for (const [pairId, verdict] of Object.entries(results ?? {})) {
      if (verdict.correct) kept[pairId] = verdict;
      else delete nextValue[pairId];
    }
    setValue(nextValue);
    setResults(Object.keys(kept).length > 0 ? kept : undefined);
    setReading(false);
    setRestored(null);
  }

  /**
   * Clearing a restored answer to make a new one. No new attempt is needed: the one
   * opened on mount was never submitted — the old answer was only painted onto it.
   */
  function answerAgain() {
    setValue({});
    setResults(undefined);
    setTally(null);
    setSolved(false);
    setReading(false);
    setRestored(null);
  }

  /**
   * A clean run at the exercise. The reveal closed the attempt server-side, so this is
   * a new attempt rather than a reset of the old one.
   */
  function restart() {
    setValue({});
    setResults(undefined);
    setRevealed(undefined);
    setTally(null);
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
   * action is to correct it, not to check the same pairing again.
   */
  const hasWrong =
    results !== undefined && Object.values(results).some((verdict) => !verdict.correct);
  const canSubmitNow = canCheck && !submit.isPending && !isRevealed && !solved;

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
              {t('matchPairs.restored', {
                date:
                  restored.at === null
                    ? ''
                    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                        new Date(restored.at),
                      ),
              })}
            </span>
            {restoredCounts !== null && (
              <span className="ml-2">{t('matchPairs.restoredScored', restoredCounts)}</span>
            )}
          </div>
          <button
            type="button"
            onClick={answerAgain}
            className="rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold"
            style={{ borderColor: PRACTICE_ACCENT, color: PRACTICE_ACCENT }}
          >
            {t('matchPairs.startOver')}
          </button>
        </div>
      )}

      <MatchPairsBody
        projection={projection}
        audio={audio}
        audioTranscript={transcript}
        {...(instruction === undefined ? {} : { instruction })}
        value={value}
        onValueChange={setValue}
        onAnswerChange={setCanCheck}
        onClearMark={clearMark}
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
          {t('matchPairs.checkFailed')}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!isRevealed && !solved && !hasWrong && (
          <button
            type="button"
            // `aria-disabled` rather than `disabled`: the button still reads as
            // unavailable and still refuses to check, but it stays reachable — and a
            // press on it is the one moment we know the learner is looking for what
            // is missing.
            aria-disabled={!canSubmitNow}
            onClick={() => {
              if (submit.isPending) return;
              if (canCheck) check();
              else showEmptySlots();
            }}
            className="rounded-lg px-4 py-2 text-[13.5px] font-semibold text-white aria-disabled:opacity-40"
            style={{ background: PRACTICE_ACCENT }}
          >
            {submit.isPending
              ? t('matchPairs.checking')
              : canCheck
                ? // AC-S7: the button says how much of the exercise it is about to
                  // check, because partial checking means that is a real choice.
                  t('matchPairs.checkCount', {
                    n: Object.keys(value).length,
                    m: projection.slots.length,
                  })
                : t('matchPairs.matchOneToCheck')}
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
            {t('matchPairs.retryAttempt', { n: attempts + 1 })}
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

        {/* After the reveal the only thing left to do is run it again from scratch.
            Without this the exercise simply ends on a screen of answers. */}
        {isRevealed && (
          <button
            type="button"
            disabled={start.isPending}
            onClick={restart}
            className="rounded-lg px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-40"
            style={{ background: PRACTICE_ACCENT }}
          >
            {t('matchPairs.restart')}
          </button>
        )}

        {reveal.isError && (
          <p role="alert" className="text-[13px] text-(--ssz-feedback-no-fg)">
            {t('matchPairs.revealFailed')}
          </p>
        )}

        {/* BEHAVIOR §2.3's footnote: which attempt this is, and how the last one
            went. While the learner is still correcting, the number they care about is
            on the button that starts the next attempt. */}
        {attempts > 0 && !isRevealed && !solved && (
          <span className="text-[12.5px] text-(--ssz-text-muted)">
            {tally === null
              ? t('matchPairs.attemptCount', { n: attempts + 1 })
              : t('matchPairs.attemptFootnote', {
                  n: attempts,
                  correct: tally.correct,
                  total: tally.total,
                })}
          </span>
        )}
      </div>
    </div>
  );
}
