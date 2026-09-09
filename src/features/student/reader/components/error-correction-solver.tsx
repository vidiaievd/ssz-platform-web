'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  AttemptRequestError,
  fetchLastAttempt,
  resolveSubmitFailure,
  useSelfCheck,
  useStartAttempt,
  useSubmitAnswer,
  type SubmitFailureResolution,
} from '@/features/student/exercises/api/use-attempt';
import {
  clearAnswerDraft,
  readAnswerDraft,
  saveAnswerDraft,
} from '@/features/student/exercises/lib/answer-draft';
import type { SelfCheckFeedback, StudentProjection } from '@/lib/shared-kernel/error-correction';
import {
  ErrorCorrectionBody,
  PRACTICE_ACCENT,
  readStudentProjection,
  type ErrorCorrectionValue,
  type ErrorCorrectionVerdicts,
} from '@/features/student/exercises/runner';
import type { AttemptRecord } from '@/features/student/exercises/types/attempts';
import { useExerciseAudio } from '@/features/student/exercises/audio';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface ErrorCorrectionSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** Fired once, on the first submission. `null`: submitted, not yet judged. */
  onChecked?: (ok: boolean | null) => void;
}

/** What the learner sent last, as the engine kept it. */
interface SubmittedEdits {
  items?: ErrorCorrectionValue;
}

/**
 * A stored draft as this template can use it, or `null`.
 *
 * Read rather than trusted: storage may hold whatever an older build of this runner put
 * there, and an entry missing the maps the body indexes into would fail inside a render
 * rather than here. A sentence whose edits do not read is dropped whole.
 */
function readEditsDraft(raw: unknown): ErrorCorrectionValue | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const value: ErrorCorrectionValue = {};
  for (const [itemId, edits] of Object.entries(raw)) {
    if (typeof edits !== 'object' || edits === null) continue;
    const { marked, fix, ins } = edits as Record<string, unknown>;
    if (typeof marked !== 'object' || marked === null) continue;
    if (typeof fix !== 'object' || fix === null) continue;
    if (typeof ins !== 'object' || ins === null) continue;
    value[itemId] = {
      marked: marked as Record<string, boolean>,
      fix: fix as Record<string, string>,
      ins: ins as Record<string, string>,
    };
  }
  return Object.keys(value).length === 0 ? null : value;
}

/**
 * `error_correction` played against the server.
 *
 * Server-graded for the same reason `word_bank_gap_fill` is, one step removed: the
 * answer key is a separate field here, but the mistakes the learner is hunting are
 * derived from it, so a browser holding the key holds the exercise.
 *
 * The flow it drives is the handoff's, and it is shorter than every other template's:
 * work → sent. There is no feedback phase, because the auto-check may only approve —
 * anything else is routed to a teacher, and inventing a verdict here while the answer
 * sits in their queue would be this screen contradicting the one they will use.
 */
export function ErrorCorrectionSolver({
  exerciseId,
  instruction,
  language,
  onChecked,
}: ErrorCorrectionSolverProps) {
  const t = useTranslations('ExerciseRunner');

  const start = useStartAttempt(exerciseId);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [projection, setProjection] = useState<StudentProjection | null>(null);
  /**
   * The document as the engine dealt it, kept for the audio layer alone: the projection
   * is the kernel's own shape and has no room for a block that is not the template's.
   */
  const [document, setDocument] = useState<unknown>(null);
  /** What the clip said, once the engine hands it over with the submission. */
  const [transcript, setTranscript] = useState<{ transcript: string; translation: string } | null>(
    null,
  );
  /** Set when the exercise arrived in a shape this runner must not play. */
  const [unusable, setUnusable] = useState(false);

  const submit = useSubmitAnswer(exerciseId, attemptId);
  const selfCheck = useSelfCheck(exerciseId, attemptId);

  const [value, setValue] = useState<ErrorCorrectionValue>({});
  /** The last self-check the server answered, cleared the moment the work changes. */
  const [feedback, setFeedback] = useState<SelfCheckFeedback | null>(null);
  const [checksLeft, setChecksLeft] = useState<number | null>(null);
  const [allTouched, setAllTouched] = useState(false);
  /** How the submission ended: approved outright, or handed to a teacher. */
  const [sent, setSent] = useState<'passed' | 'review' | null>(null);
  /**
   * The teacher's verdict, once one has read the submission. It is the only feedback this
   * template can give beyond "it matched the key", and it arrives with the attempt rather
   * than through this screen — nothing here asks for it.
   */
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [submissions, setSubmissions] = useState(0);
  /**
   * How a failed `submit` actually left things (47.0.B) — `null` while nothing has
   * failed, or once resolved as delivered, in which case `sent` already carries the
   * news and this has nothing further to say.
   */
  const [sendFailure, setSendFailure] = useState<SubmitFailureResolution | null>(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);

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
          const projected = readStudentProjection(data.exerciseContent);
          if (projected === null) {
            // The server did not mask this exercise — which also means it sent the
            // answer key along. Refuse it rather than play an exercise whose answers
            // are in the page.
            setUnusable(true);
            return;
          }

          setAttemptId(data.attemptId);
          setProjection(projected);
          setDocument(data.exerciseContent);
          setTranscript(null);
          openedAt.current = Date.now();

          if (restoreConsidered.current) return;
          restoreConsidered.current = true;

          const saved = await fetchLastAttempt(exerciseId);
          const items = (saved?.submittedAnswer as SubmittedEdits | null)?.items;
          if (saved === null || items === undefined || Object.keys(items).length === 0) {
            // Nothing was ever handed in, so the edits are only in the browser — and
            // reopening the exercise abandoned the attempt that held them (47.0.C).
            const draft = readEditsDraft(readAnswerDraft(exerciseId));
            if (draft !== null) setValue(draft);
            return;
          }

          // Handed-in work wins over the draft that produced it.
          clearAnswerDraft(exerciseId);
          setValue(items);
          // What the teacher decided is not this screen's to say, but that the work was
          // handed over is — otherwise a learner who comes back sees their own edits and
          // no sign they ever sent them.
          setSent(saved.status === 'ROUTED_FOR_REVIEW' ? 'review' : 'passed');
          // A string, not merely "not null": an attempt read back from an engine that
          // predates review carries no such field at all.
          if (typeof saved.reviewedAt === 'string') setReview(readReview(saved));
        },
      },
    );
  }, [startMutate, language, exerciseId]);

  useEffect(() => {
    begin();
  }, [begin]);

  /**
   * The listening layer, mounted once for the whole exercise: the allowance, the gate and
   * the playthrough belong to it, not to a sentence.
   */
  const audio = useExerciseAudio(document);

  const retry = useCallback(() => {
    setUnusable(false);
    begin();
  }, [begin]);

  /**
   * Pointing out the sentences still untouched, after the learner presses submit too
   * early. It runs out on its own: an untouched sentence is work not done yet, not a
   * mistake, and a marking that stayed would say otherwise for the rest of the exercise.
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

  const untouchedCount = projection.items.filter((item) => {
    const edits = value[item.id];
    if (edits === undefined) return true;
    const changes =
      Object.values(edits.marked).filter(Boolean).length +
      Object.values(edits.ins).filter((word) => word.trim() !== '').length;
    return changes === 0;
  }).length;
  const totalItems = projection.items.length;
  /** The author's budget until the engine says otherwise, and its word after that. */
  const checksAvailable = checksLeft ?? projection.flow.selfCheck;

  function showUntouched() {
    if (pointOutTimer.current !== null) clearTimeout(pointOutTimer.current);
    setPointOut(true);
    pointOutTimer.current = setTimeout(() => setPointOut(false), 2000);
  }

  function send() {
    setSendFailure(null);
    submit.mutate(
      {
        submittedAnswer: { items: value },
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
      },
      {
        onSuccess: (data) => {
          clearAnswerDraft(exerciseId);
          // The work is in, so the clip has nothing left to give away.
          if (data.audioTranscript !== undefined) setTranscript(data.audioTranscript);
          setSent(data.requiresReview ? 'review' : 'passed');
          // `null` on a routed answer: it has been done, and whether it was right is
          // the teacher's to say. The reader counts it as attempted either way.
          if (submissions === 0) onChecked?.(data.requiresReview ? null : data.correct);
          setSubmissions((n) => n + 1);
        },
        onError: async () => {
          if (attemptId === null) return;
          setConfirmingDelivery(true);
          const resolution = await resolveSubmitFailure(exerciseId, attemptId);
          setConfirmingDelivery(false);
          if (resolution === 'delivered') {
            // It reached the engine; only the response was lost. Saying so calmly is
            // owed here — a second "send" would try to hand in what is already there.
            clearAnswerDraft(exerciseId);
            setSent('review');
            if (submissions === 0) onChecked?.(null);
            setSubmissions((n) => n + 1);
          } else {
            setSendFailure(resolution);
          }
        },
      },
    );
  }

  /**
   * Any edit retires the last self-check.
   *
   * Its counts were about the work as it stood, and the server cannot recount without
   * being asked — a panel left standing after the next change would be saying something
   * that is no longer true about a sentence the learner is still working on.
   */
  function changeValue(next: ErrorCorrectionValue) {
    setValue(next);
    setFeedback(null);
    // Kept for a reload the learner did not plan, not for sending on their behalf
    // (47.0.C).
    saveAnswerDraft(exerciseId, next);
  }

  function askSelfCheck() {
    selfCheck.mutate(
      { draftAnswer: { items: value } },
      {
        onSuccess: (data) => {
          // The endpoint serves two templates now; a payload for the other one is not a
          // thing to render half of.
          if (data.templateCode !== 'error_correction') return;
          setFeedback({
            items: data.items,
            fixedCount: data.fixedCount,
            spanCount: data.spanCount,
          });
          setChecksLeft(data.checksLeft);
        },
        onError: (error) => {
          // 422 is the budget, not a fault: the engine counts the spending, and it has
          // the last word over whatever this screen thinks is left.
          if (error instanceof AttemptRequestError && error.status === 422) setChecksLeft(0);
        },
      },
    );
  }

  function again() {
    clearAnswerDraft(exerciseId);
    setValue({});
    setFeedback(null);
    setChecksLeft(null);
    setSent(null);
    setReview(null);
    setSubmissions(0);
    setSendFailure(null);
    begin();
  }

  return (
    <div>
      <ErrorCorrectionBody
        projection={projection}
        {...(instruction === undefined ? {} : { instruction })}
        value={value}
        onValueChange={changeValue}
        selfCheck={feedback}
        onAnswerChange={setAllTouched}
        phase={sent === null ? 'answering' : 'feedback'}
        mode="practice"
        accent={PRACTICE_ACCENT}
        pointOut={pointOut}
        verdicts={review?.verdicts ?? null}
        audio={audio}
        audioTranscript={transcript}
      />

      {sent === null ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/*
            The self-check, when the author granted any. It is rationed on the server —
            unlimited asking would turn the exercise into a search, one word at a time —
            so the count shown here is the engine's answer, not this screen's tally.
          */}
          {projection.flow.selfCheck > 0 && (
            <button
              type="button"
              disabled={
                selfCheck.isPending || checksAvailable === 0 || untouchedCount === totalItems
              }
              onClick={askSelfCheck}
              className="rounded-xl border px-4 py-2.5 text-[13px] font-semibold disabled:opacity-60"
              style={{ borderColor: 'var(--ssz-border-strong)', color: 'var(--ssz-text-primary)' }}
            >
              {selfCheck.isPending
                ? t('errorCorrection.selfCheck.checking')
                : checksAvailable === 0
                  ? t('errorCorrection.selfCheck.spent')
                  : t('errorCorrection.selfCheck.button', { left: checksAvailable })}
            </button>
          )}
          {feedback !== null && (
            <span className="text-[12.5px] text-(--ssz-text-secondary)">
              {t('errorCorrection.selfCheck.summary', {
                fixed: feedback.fixedCount,
                total: feedback.spanCount,
              })}
            </span>
          )}
          {selfCheck.isError && checksAvailable > 0 && (
            <span className="text-[12.5px] text-(--ssz-feedback-no-fg)">
              {t('errorCorrection.selfCheck.failed')}
            </span>
          )}
          <button
            type="button"
            disabled={submit.isPending || confirmingDelivery}
            onClick={allTouched ? send : showUntouched}
            className="rounded-xl px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
            style={{ background: PRACTICE_ACCENT }}
          >
            {submit.isPending || confirmingDelivery
              ? t('errorCorrection.sending')
              : t('errorCorrection.send')}
          </button>
          {!allTouched && (
            <span className="text-[12.5px] text-(--ssz-text-muted)">
              {t('errorCorrection.untouched', { count: untouchedCount })}
            </span>
          )}
          {/*
            47.0.B: resolved against the server before showing anything — see
            translate-solver.tsx for why "not-delivered" and "unconfirmed" are kept
            apart, and why a delivered attempt skips this and moves `sent` on instead.
          */}
          {sendFailure === 'not-delivered' && (
            <span className="text-[12.5px] text-(--ssz-feedback-no-fg)">
              {t('errorCorrection.sendFailedRetry')}
            </span>
          )}
          {sendFailure === 'unconfirmed' && (
            <span className="text-[12.5px] text-(--ssz-feedback-no-fg)">
              {t('errorCorrection.sendUnconfirmed')}
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
          {review !== null ? (
            <>
              <p
                className="text-[14px] font-semibold"
                style={{
                  color:
                    review.status === 'RETURNED'
                      ? 'var(--ssz-text-primary)'
                      : 'var(--ssz-feedback-ok-fg)',
                }}
              >
                {review.status === 'RETURNED'
                  ? t('errorCorrection.review.sentBack')
                  : t('errorCorrection.review.marked')}
              </p>
              {review.status !== 'RETURNED' && review.score !== null && (
                <p className="mt-1 text-[12.5px] text-(--ssz-text-secondary)">
                  {t('errorCorrection.review.score', { score: review.score })}
                </p>
              )}
              {/* The teacher's own words, where they wrote any. Nothing is put here in
                  their place: a made-up explanation is worse than none. */}
              {review.comment !== null && (
                <p className="mt-2 text-[13px] text-(--ssz-text-primary)">{review.comment}</p>
              )}
            </>
          ) : (
            <>
              <p
                className="text-[14px] font-semibold"
                style={{
                  color:
                    sent === 'passed' ? 'var(--ssz-feedback-ok-fg)' : 'var(--ssz-text-primary)',
                }}
              >
                {sent === 'passed'
                  ? t('errorCorrection.approved')
                  : t('errorCorrection.withTeacher')}
              </p>
              {sent === 'review' && (
                <p className="mt-1 text-[12.5px] text-(--ssz-text-secondary)">
                  {t('errorCorrection.withTeacherWhen')}
                </p>
              )}
            </>
          )}
          {projection.flow.attempts === 'free' && (
            <button
              type="button"
              onClick={again}
              className="mt-2 text-[12.5px] font-semibold underline underline-offset-2"
              style={{ color: 'var(--ssz-text-secondary)' }}
            >
              {t('errorCorrection.again')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The teacher's verdict as this screen holds it. */
interface AttemptReview {
  status: AttemptRecord['status'];
  score: number | null;
  comment: string | null;
  verdicts: ErrorCorrectionVerdicts;
}

/**
 * The teacher's verdict, out of the attempt record.
 *
 * Read rather than trusted wholesale: the decisions are a JSON column upstream, and a
 * shape this screen cannot read is one it should show nothing for rather than crash on.
 */
function readReview(attempt: AttemptRecord): AttemptReview {
  const verdicts: ErrorCorrectionVerdicts = {};
  for (const decision of attempt.reviewDecisions ?? []) {
    if (typeof decision?.itemId !== 'string') continue;
    verdicts[decision.itemId] = {
      approved: decision.approved === true,
      ...(typeof decision.comment === 'string' && decision.comment.trim() !== ''
        ? { comment: decision.comment }
        : {}),
    };
  }

  return {
    status: attempt.status,
    score: attempt.score,
    comment:
      typeof attempt.reviewComment === 'string' && attempt.reviewComment.trim() !== ''
        ? attempt.reviewComment
        : null,
    verdicts,
  };
}
