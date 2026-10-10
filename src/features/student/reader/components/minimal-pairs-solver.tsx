'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useExerciseForRunner } from '@/features/content/api/use-exercise';
import {
  AttemptRequestError,
  fetchResumable,
  useAnswerQuestion,
  useHandOutProbe,
  useStartAttempt,
  useSubmitAnswer,
} from '@/features/student/exercises/api/use-attempt';
import {
  MinimalPairsBody,
  MinimalPairsReaderCard,
  PRACTICE_ACCENT,
  readMinimalPairsProjection,
  readMinimalPairsSummary,
  readProbe,
  readProbeVerdict,
  useClipPlayer,
  useMinimalPairsSitting,
  type SittingDriver,
} from '@/features/student/exercises/runner';
import type { StudentProjection } from '@/lib/shared-kernel/minimal-pairs';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface MinimalPairsSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** The exercise's title, from the lesson item — the card's heading where the set has none. */
  title?: string;
  /** Fired once per sitting, with its verdict — the submit the evidence is written on. */
  onChecked?: (ok: boolean | null) => void;
  /** On the shared solver signature, unread: the card is this runner's fold. */
  stacked?: boolean;
}

/** Why a sitting could not be started. */
type Refusal = { kind: 'spent'; allowed: number } | { kind: 'empty' } | { kind: 'failed' };

/** How the start's failure reads — the engine's two refusals by their code (plan 72, Q4-A). */
function refusalOf(e: unknown): Refusal {
  if (e instanceof AttemptRequestError && e.status === 422) {
    if (e.code === 'MP_SITTINGS_SPENT') return { kind: 'spent', allowed: e.allowed ?? 0 };
    if (e.code === 'MP_EMPTY_SET') return { kind: 'empty' };
  }
  return { kind: 'failed' };
}

/**
 * `minimal_pairs` in the reader: a card, then one sitting against the server (plan 72, phase 6).
 *
 * **The card first** (§7.10), drawn from the display projection the exercise page has already
 * loaded — no attempt, no draw, no clip until «Start». The press is also the gesture the browser
 * wants before the first probe may play by itself. A learner coming back to a sitting with
 * answered probes does not see it: the engine resumes that attempt on the probe it was on
 * (MP-R15), and the card would only stand in the way.
 *
 * **«Ny runde» is a new attempt** with a new draw (§3.7). The sitting is keyed by its attempt, so
 * a new one starts from nothing; a round the author does not allow is refused by the engine and
 * said so under the button (Q4-A).
 */
export function MinimalPairsSolver({
  exerciseId,
  instruction,
  language,
  title,
  onChecked,
}: MinimalPairsSolverProps) {
  const t = useTranslations('ExerciseRunner.minimalPairs');
  const display = useExerciseForRunner(exerciseId);
  const [stage, setStage] = useState<'deciding' | 'card' | 'run'>('deciding');

  const start = useStartAttempt(exerciseId);
  const [sitting, setSitting] = useState<{
    attemptId: string;
    projection: StudentProjection;
  } | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [starting, setStarting] = useState(false);

  const startAsync = start.mutateAsync;
  const begin = useCallback(() => {
    // A promise, not `mutate(vars, { onSuccess })`: per-call callbacks are let go of when strict
    // mode re-mounts, and the start would go unread (plan 67, ph. 9).
    setStarting(true);
    setRefusal(null);
    startAsync({ language })
      .then((data) => {
        const projection = readMinimalPairsProjection(data.exerciseContent);
        if (projection === null) {
          setRefusal({ kind: 'failed' });
          return;
        }
        setSitting({ attemptId: data.attemptId, projection });
        setStage('run');
      })
      .catch((e: unknown) => setRefusal(refusalOf(e)))
      .finally(() => setStarting(false));
  }, [startAsync, language]);

  // Once per mount, like the start itself (plan 67, ph. 9).
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void fetchResumable(exerciseId).then((resumable) => {
      if (!resumable) {
        setStage('card');
        return;
      }
      setStage('run');
      begin();
    });
  }, [exerciseId, begin]);

  if (stage === 'run' && sitting !== null) {
    return (
      <MinimalPairsRun
        key={sitting.attemptId}
        exerciseId={exerciseId}
        attemptId={sitting.attemptId}
        projection={sitting.projection}
        {...(instruction === undefined ? {} : { instruction })}
        {...(onChecked === undefined ? {} : { onChecked })}
        onRestart={begin}
        restarting={starting}
        sittingsSpent={refusal?.kind === 'spent' ? refusal.allowed : null}
      />
    );
  }

  // A resumed sitting that could not be reopened falls back to the card, which can try again.
  if (stage === 'run' && refusal === null) {
    return <LearningSkeleton variant="list" rows={3} />;
  }

  if (stage === 'deciding' || display.isLoading) {
    return <LearningSkeleton variant="list" rows={2} />;
  }

  const projection = readMinimalPairsProjection(display.data?.content);
  if (display.isError || projection === null) {
    return <ErrorState onRetry={() => display.refetch()} />;
  }

  const notice =
    refusal === null
      ? null
      : refusal.kind === 'spent'
        ? t('summary.sittingsSpent', { n: refusal.allowed })
        : refusal.kind === 'empty'
          ? t('failure.emptySet')
          : t('failure.start');

  return (
    <MinimalPairsReaderCard
      projection={projection}
      {...(title === undefined ? {} : { title })}
      {...(instruction === undefined ? {} : { instruction })}
      onStart={begin}
      starting={starting}
      notice={notice}
      blocked={refusal !== null && refusal.kind !== 'failed'}
      accent={PRACTICE_ACCENT}
    />
  );
}

interface MinimalPairsRunProps {
  exerciseId: string;
  attemptId: string;
  projection: StudentProjection;
  instruction?: string;
  onChecked?: (ok: boolean | null) => void;
  onRestart: () => void;
  restarting: boolean;
  sittingsSpent: number | null;
}

/**
 * One sitting: the engine as the sitting's driver (plan 72 §3.6).
 *
 * `next` is `/items` — the probe the sitting is on, or «all closed» when the last one is
 * answered and the submit is what is left (a reload after the last answer lands there).
 * `answer` is `/answers` with the button's id. `finish` is the submit, whose body the engine
 * ignores: it sums the sitting from what it recorded.
 */
function MinimalPairsRun({
  exerciseId,
  attemptId,
  projection,
  instruction,
  onChecked,
  onRestart,
  restarting,
  sittingsSpent,
}: MinimalPairsRunProps) {
  const clips = useClipPlayer();
  const handOut = useHandOutProbe(exerciseId).mutateAsync;
  const answer = useAnswerQuestion<unknown>(exerciseId, attemptId).mutateAsync;
  const submit = useSubmitAnswer(exerciseId, attemptId).mutateAsync;

  /** Wall-clock since the sitting opened; the engine records it with the submission. */
  const [openedAt] = useState(() => Date.now());

  const driver = useMemo<SittingDriver>(
    () => ({
      next: () =>
        handOut(attemptId).then(
          (raw) => {
            const probe = readProbe(raw);
            if (probe === null) throw new Error('Not a probe');
            return probe;
          },
          (e: unknown) => {
            if (e instanceof AttemptRequestError && e.code === 'ALL_PROBES_CLOSED') {
              return 'closed' as const;
            }
            throw e;
          },
        ),
      answer: (questionId, optionId) =>
        answer({ questionId, optionId }).then((data) => {
          const verdict = readProbeVerdict(data.result);
          if (verdict === null) throw new Error('Not a verdict');
          return verdict;
        }),
      finish: () =>
        submit({
          submittedAnswer: {},
          timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt) / 1000)),
        }).then((data) => {
          const summary = readMinimalPairsSummary(data.details);
          if (summary === null) throw new Error('Not a result');
          return summary;
        }),
    }),
    [handOut, answer, submit, attemptId, openedAt],
  );

  const sitting = useMinimalPairsSitting({
    driver,
    clips,
    playsPerProbe: projection.set.playsPerProbe,
    autoplay: projection.set.autoplay,
    onFinished: (summary) => onChecked?.(summary.passed),
    isRefusal: (e) => e instanceof AttemptRequestError && e.status === 422,
    isMediaFailure: (e) => e instanceof AttemptRequestError && e.code === 'MEDIA_UNAVAILABLE',
  });

  // The first probe, once per mount — a dev double-run would otherwise ask twice; harmless, since
  // `/items` is idempotent, but the autoplay would be scheduled twice.
  const begun = useRef(false);
  const beginSitting = sitting.begin;
  useEffect(() => {
    if (begun.current) return;
    begun.current = true;
    beginSitting();
  }, [beginSitting]);

  // The reader owns the instruction line — translated per learner, while the projection carries
  // the author's own. One or the other, never both (precedent: plan 53 §5).
  return (
    <MinimalPairsBody
      projection={projection}
      sitting={sitting}
      clips={clips}
      {...(instruction === undefined ? {} : { instruction })}
      onRestart={onRestart}
      restarting={restarting}
      sittingsSpent={sittingsSpent}
      accent={PRACTICE_ACCENT}
    />
  );
}
