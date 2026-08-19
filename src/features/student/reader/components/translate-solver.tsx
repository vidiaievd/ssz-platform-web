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
import type {
  AttemptRecord,
  TranslateSubmitDetails,
} from '@/features/student/exercises/types/attempts';
import {
  clearAnswerDraft,
  readAnswerDraft,
  saveAnswerDraft,
} from '@/features/student/exercises/lib/answer-draft';
import { readSubmission, toSubmission } from '@/lib/shared-kernel/translate';
import type { SelfCheckFeedback, StudentProjection } from '@/lib/shared-kernel/translate';
import {
  PRACTICE_ACCENT,
  readTranslateProjection,
  TranslateRunnerBody,
  type TranslateRouting,
  type TranslateValue,
  type TranslateVerdicts,
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
  const selfCheck = useSelfCheck(exerciseId, attemptId);

  const [value, setValue] = useState<TranslateValue>({});
  /** The last self-check the server answered, cleared the moment the work changes. */
  const [feedback, setFeedback] = useState<SelfCheckFeedback | null>(null);
  const [checksLeft, setChecksLeft] = useState<number | null>(null);
  const [allWritten, setAllWritten] = useState(false);
  /** How the submission ended: approved outright, or handed to a teacher. */
  const [sent, setSent] = useState<'passed' | 'review' | null>(null);
  /** Per sentence, as the server decided it. Absent when a restored attempt kept none. */
  const [routing, setRouting] = useState<TranslateRouting | null>(null);
  /**
   * The teacher's verdict, once one has read the submission. It is the only feedback this
   * template can give beyond "it matched the key", and it arrives with the attempt rather
   * than through this screen — nothing here asks for it.
   */
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [submissions, setSubmissions] = useState(0);
  /**
   * How a failed `submit` actually left things (47.0.B) — `null` while nothing has
   * failed, or once the check above resolved it as delivered, in which case `sent`
   * already carries the news and this has nothing further to say.
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
          const answers = saved === null ? {} : readSubmission(saved.submittedAnswer);
          if (saved === null || Object.keys(answers).length === 0) {
            // Nothing was ever handed in, so anything the learner had written is only in
            // the browser — and reopening the exercise abandoned the attempt that held
            // it (47.0.C). The draft is the only copy there is.
            const draft = readTranslateDraft(readAnswerDraft(exerciseId));
            if (draft !== null) setValue(draft);
            return;
          }

          // Handed-in work wins over the draft that produced it: what reached the engine
          // is the answer of record, and the draft is now history.
          clearAnswerDraft(exerciseId);
          setValue(answers);
          // What the teacher decided is not this screen's to say, but that the work was
          // handed over is — otherwise a learner who comes back sees their own sentences
          // and no sign they ever sent them.
          setSent(saved.status === 'ROUTED_FOR_REVIEW' ? 'review' : 'passed');
          setRouting(readRouting(saved.validationDetails));
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
  /** The author's budget until the engine says otherwise, and its word after that. */
  const checksAvailable = checksLeft ?? projection.flow.selfCheck;

  function showEmpty() {
    if (pointOutTimer.current !== null) clearTimeout(pointOutTimer.current);
    setPointOut(true);
    pointOutTimer.current = setTimeout(() => setPointOut(false), 2000);
  }

  function send() {
    setSendFailure(null);
    submit.mutate(
      {
        submittedAnswer: { answers: toSubmission(items, value) },
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
      },
      {
        onSuccess: (data) => {
          clearAnswerDraft(exerciseId);
          setSent(data.requiresReview ? 'review' : 'passed');
          setRouting(readRouting(data.details));
          // `null` on a routed answer: it has been done, and whether it was right is the
          // teacher's to say. The reader counts it as attempted either way.
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
   * It judged the sentences as they stood, and the server cannot re-judge them without
   * being asked — a panel left standing after the next keystroke would be saying
   * something that is no longer true about the sentence being rewritten.
   */
  function changeValue(next: TranslateValue) {
    setValue(next);
    setFeedback(null);
    // Kept for a reload the learner did not plan, not for sending on their behalf
    // (47.0.C) — a failed hand-in leaves the sentences here, and this is what leaves
    // them here across a refresh too.
    saveAnswerDraft(exerciseId, next);
  }

  function askSelfCheck() {
    selfCheck.mutate(
      { draftAnswer: { answers: toSubmission(items, value) } },
      {
        onSuccess: (data) => {
          // The endpoint serves the other self-checkable template too, and its payload
          // shares nothing with this one but the word `items`.
          if (data.templateCode === 'error_correction') return;
          setFeedback({ items: data.items, passing: data.passing });
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
    setRouting(null);
    setReview(null);
    setSubmissions(0);
    setSendFailure(null);
    begin();
  }

  return (
    <div>
      <TranslateRunnerBody
        projection={projection}
        {...(instruction === undefined ? {} : { instruction })}
        value={value}
        onValueChange={changeValue}
        onAnswerChange={setAllWritten}
        selfCheck={feedback}
        phase={sent === null ? 'answering' : 'feedback'}
        mode="practice"
        accent={PRACTICE_ACCENT}
        pointOut={pointOut}
        routing={routing}
        verdicts={review?.verdicts ?? null}
      />

      {sent === null ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/*
            The self-check, when the author granted any. It is rationed on the server —
            the diff would otherwise hand over the key one word per call, which is also
            why the key's words come back masked — so the count shown here is the
            engine's answer, not this screen's tally.
          */}
          {projection.flow.selfCheck > 0 && (
            <button
              type="button"
              disabled={selfCheck.isPending || checksAvailable === 0 || emptyCount === items.length}
              onClick={askSelfCheck}
              className="rounded-xl border px-4 py-2.5 text-[13px] font-semibold disabled:opacity-60"
              style={{ borderColor: 'var(--ssz-border-strong)', color: 'var(--ssz-text-primary)' }}
            >
              {selfCheck.isPending
                ? t('translate.selfCheck.checking')
                : checksAvailable === 0
                  ? t('translate.selfCheck.spent')
                  : t('translate.selfCheck.button', { left: checksAvailable })}
            </button>
          )}
          {/*
            What the check found, as a count of sentences that would close by themselves.
            It is the only summing-up this template can make before a teacher reads the
            work: everything else it knows is a distance, not a verdict.
          */}
          {feedback !== null && projection.exactPasses && (
            <span className="text-[12.5px] text-(--ssz-text-secondary)">
              {t('translate.selfCheck.summary', {
                passing: feedback.passing,
                total: items.length,
              })}
            </span>
          )}
          {selfCheck.isError && checksAvailable > 0 && (
            <span className="text-[12.5px] text-(--ssz-feedback-no-fg)">
              {t('translate.selfCheck.failed')}
            </span>
          )}
          <button
            type="button"
            disabled={submit.isPending || confirmingDelivery}
            onClick={allWritten ? send : showEmpty}
            className="rounded-xl px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
            style={{ background: PRACTICE_ACCENT }}
          >
            {submit.isPending || confirmingDelivery ? t('translate.sending') : t('translate.send')}
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
          {/*
            47.0.B: a failed `submit` is resolved against the server before this shows
            anything — "not-delivered" (nothing arrived, try again) reads differently
            from "unconfirmed" (the check itself failed, so neither "sent" nor "lost"
            would be true). A `resolveSubmitFailure` call that found the work already
            delivered skips this entirely and moves `sent` on instead.
          */}
          {sendFailure === 'not-delivered' && (
            <span className="text-[12.5px] text-(--ssz-feedback-no-fg)">
              {t('translate.sendFailedRetry')}
            </span>
          )}
          {sendFailure === 'unconfirmed' && (
            <span className="text-[12.5px] text-(--ssz-feedback-no-fg)">
              {t('translate.sendUnconfirmed')}
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
                  ? t('translate.review.sentBack')
                  : t('translate.review.marked')}
              </p>
              {review.status !== 'RETURNED' && review.score !== null && (
                <p className="mt-1 text-[12.5px] text-(--ssz-text-secondary)">
                  {t('translate.review.score', { score: review.score })}
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
                {sent === 'passed' ? t('translate.approved') : t('translate.withTeacher')}
              </p>
              {sent === 'review' && (
                <p className="mt-1 text-[12.5px] text-(--ssz-text-secondary)">
                  {approved !== null && approved > 0
                    ? t('translate.withTeacherSplit', { approved, total: items.length })
                    : t('translate.withTeacherWhen')}
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
              {t('translate.again')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A stored draft as this template can use it, or `null`.
 *
 * Read rather than trusted: what comes back is whatever was in storage under this key,
 * possibly written by an older build of this runner. A sentence that is not a string is
 * dropped, and nothing that fails here reaches the field.
 */
function readTranslateDraft(raw: unknown): TranslateValue | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const value: TranslateValue = {};
  for (const [itemId, text] of Object.entries(raw)) {
    if (typeof text === 'string') value[itemId] = text;
  }
  return Object.keys(value).length === 0 ? null : value;
}

/** The teacher's verdict as this screen holds it. */
interface AttemptReview {
  status: AttemptRecord['status'];
  score: number | null;
  comment: string | null;
  verdicts: TranslateVerdicts;
}

/**
 * The teacher's verdict, out of the attempt record.
 *
 * Read rather than trusted wholesale: the decisions are a JSON column upstream, and a
 * shape this screen cannot read is one it should show nothing for rather than crash on.
 */
function readReview(attempt: AttemptRecord): AttemptReview {
  const verdicts: TranslateVerdicts = {};
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
