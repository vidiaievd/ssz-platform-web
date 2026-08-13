'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  fetchLastAttempt,
  useStartAttempt,
  useSubmitAnswer,
} from '@/features/student/exercises/api/use-attempt';
import type { TranslateSubmitDetails } from '@/features/student/exercises/types/attempts';
import { readSubmission, toSubmission } from '@/lib/shared-kernel/translate';
import type { StudentProjection } from '@/lib/shared-kernel/translate';
import {
  PRACTICE_ACCENT,
  readTranslateProjection,
  TranslateRunnerBody,
  type TranslateRouting,
  type TranslateValue,
} from '@/features/student/exercises/runner';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface TranslateSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** Fired once, on the first submission. `null`: submitted, not yet judged. */
  onChecked?: (ok: boolean | null) => void;
}

/**
 * `translate_to_target` / `translate_from_target` played against the server.
 *
 * Server-graded for the plainest reason of the three server-graded templates: the
 * accepted translations *are* the answer, so a browser that could grade the exercise
 * would be a browser holding it.
 *
 * The flow is the handoff's, and it stops one step short of the other runners': work →
 * sent. There is no feedback phase, because the auto-check of this template may only
 * approve — everything else waits for a teacher, and a verdict invented here would be
 * this screen contradicting the queue the answer is sitting in.
 */
export function TranslateSolver({
  exerciseId,
  instruction,
  language,
  onChecked,
}: TranslateSolverProps) {
  const t = useTranslations('ExerciseRunner');

  const start = useStartAttempt(exerciseId);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [projection, setProjection] = useState<StudentProjection | null>(null);
  /** Set when the exercise arrived in a shape this runner must not play. */
  const [unusable, setUnusable] = useState(false);

  const submit = useSubmitAnswer(exerciseId, attemptId);

  const [value, setValue] = useState<TranslateValue>({});
  const [allWritten, setAllWritten] = useState(false);
  /** How the submission ended: approved outright, or handed to a teacher. */
  const [sent, setSent] = useState<'passed' | 'review' | null>(null);
  /** Per sentence, as the server decided it. Absent when a restored attempt kept none. */
  const [routing, setRouting] = useState<TranslateRouting | null>(null);
  const [submissions, setSubmissions] = useState(0);

  /** Wall-clock since the attempt opened; the engine records it per submission. */
  const openedAt = useRef(0);
  /** The saved answer gets one chance to appear, when the sentences arrive. */
  const restoreConsidered = useRef(false);

  const startMutate = start.mutate;
  const begin = useCallback(() => {
    startMutate(
      { language },
      {
        onSuccess: async (data) => {
          const projected = readTranslateProjection(data.exerciseContent);
          if (projected === null) {
            // The server sent the stored document rather than the projection — which
            // means it sent the accepted translations along with it. Refuse it rather
            // than play an exercise whose answers are in the page.
            setUnusable(true);
            return;
          }

          setAttemptId(data.attemptId);
          setProjection(projected);
          openedAt.current = Date.now();

          if (restoreConsidered.current) return;
          restoreConsidered.current = true;

          const saved = await fetchLastAttempt(exerciseId);
          if (saved === null) return;
          const answers = readSubmission(saved.submittedAnswer);
          if (Object.keys(answers).length === 0) return;

          setValue(answers);
          // What the teacher decided is not this screen's to say, but that the work was
          // handed over is — otherwise a learner who comes back sees their own sentences
          // and no sign they ever sent them.
          setSent(saved.status === 'ROUTED_FOR_REVIEW' ? 'review' : 'passed');
          setRouting(readRouting(saved.validationDetails));
        },
      },
    );
  }, [startMutate, language, exerciseId]);

  useEffect(() => {
    begin();
  }, [begin]);

  const retry = useCallback(() => {
    setUnusable(false);
    begin();
  }, [begin]);

  /**
   * Pointing out the sentences still empty, after the learner presses submit too early.
   * It runs out on its own: an empty sentence is work not done yet, not a mistake, and
   * a marking that stayed would say otherwise for the rest of the exercise.
   */
  const [pointOut, setPointOut] = useState(false);
  const pointOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pointOutTimer.current !== null) clearTimeout(pointOutTimer.current);
    },
    [],
  );

  if (!unusable && (start.isPending || (start.isSuccess && projection === null))) {
    return <LearningSkeleton variant="list" rows={4} />;
  }
  if (unusable || start.isError || projection === null || attemptId === null) {
    return <ErrorState onRetry={retry} />;
  }

  const items = projection.items;
  const emptyCount = items.filter((item) => (value[item.id] ?? '').trim() === '').length;
  const approved =
    routing === null ? null : items.filter((item) => routing[item.id] === 'pass').length;

  function showEmpty() {
    if (pointOutTimer.current !== null) clearTimeout(pointOutTimer.current);
    setPointOut(true);
    pointOutTimer.current = setTimeout(() => setPointOut(false), 2000);
  }

  function send() {
    submit.mutate(
      {
        submittedAnswer: { answers: toSubmission(items, value) },
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
      },
      {
        onSuccess: (data) => {
          setSent(data.requiresReview ? 'review' : 'passed');
          setRouting(readRouting(data.details));
          // `null` on a routed answer: it has been done, and whether it was right is the
          // teacher's to say. The reader counts it as attempted either way.
          if (submissions === 0) onChecked?.(data.requiresReview ? null : data.correct);
          setSubmissions((n) => n + 1);
        },
      },
    );
  }

  function again() {
    setValue({});
    setSent(null);
    setRouting(null);
    setSubmissions(0);
    begin();
  }

  return (
    <div>
      <TranslateRunnerBody
        projection={projection}
        {...(instruction === undefined ? {} : { instruction })}
        value={value}
        onValueChange={setValue}
        onAnswerChange={setAllWritten}
        phase={sent === null ? 'answering' : 'feedback'}
        mode="practice"
        accent={PRACTICE_ACCENT}
        pointOut={pointOut}
        routing={routing}
      />

      {sent === null ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={submit.isPending}
            onClick={allWritten ? send : showEmpty}
            className="rounded-xl px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
            style={{ background: PRACTICE_ACCENT }}
          >
            {submit.isPending ? t('translate.sending') : t('translate.send')}
          </button>
          {/*
            Why the button is off, or — once it is on — what handing in will do. The
            second half is the one thing this template owes the learner up front: an
            answer that matches the key is done, and everything else is read by a person.
          */}
          <span className="text-[12.5px] text-(--ssz-text-muted)">
            {!allWritten
              ? t('translate.missing', { count: emptyCount })
              : projection.exactPasses
                ? t('translate.exactPasses')
                : t('translate.allRead')}
          </span>
          {submit.isError && (
            <span className="text-[12.5px] text-(--ssz-feedback-no-fg)">
              {t('translate.sendFailed')}
            </span>
          )}
        </div>
      ) : (
        <div
          className="mt-4 rounded-2xl border px-4 py-3"
          style={{
            borderColor:
              sent === 'passed' ? 'var(--ssz-feedback-ok-line)' : 'var(--ssz-border-default)',
            background:
              sent === 'passed' ? 'var(--ssz-feedback-ok-bg)' : 'var(--ssz-bg-surface-subtle)',
          }}
        >
          <p
            className="text-[14px] font-semibold"
            style={{
              color: sent === 'passed' ? 'var(--ssz-feedback-ok-fg)' : 'var(--ssz-text-primary)',
            }}
          >
            {sent === 'passed' ? t('translate.approved') : t('translate.withTeacher')}
          </p>
          {sent === 'review' && (
            <p className="mt-1 text-[12.5px] text-(--ssz-text-secondary)">
              {approved !== null && approved > 0
                ? t('translate.withTeacherSplit', { approved, total: items.length })
                : t('translate.withTeacherWhen')}
            </p>
          )}
          {projection.flow.attempts === 'free' && (
            <button
              type="button"
              onClick={again}
              className="mt-2 text-[12.5px] font-semibold underline underline-offset-2"
              style={{ color: 'var(--ssz-text-secondary)' }}
            >
              {t('translate.again')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The routing the server reported, per sentence.
 *
 * Everything else a translate detail holds — the variant compared against, the diff
 * against it, the rules it tripped — is written for the teacher queue and is stripped
 * before it leaves the engine. What is left is what the badges on the cards say.
 */
function readRouting(details: unknown): TranslateRouting | null {
  if (typeof details !== 'object' || details === null) return null;

  const { items } = details as Partial<TranslateSubmitDetails>;
  if (!Array.isArray(items)) return null;

  const routing: TranslateRouting = {};
  for (const item of items) {
    if (typeof item?.itemId !== 'string') continue;
    if (item.routing !== 'pass' && item.routing !== 'teacher') continue;
    routing[item.itemId] = item.routing;
  }
  return Object.keys(routing).length === 0 ? null : routing;
}
