'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  AttemptRequestError,
  fetchLastAttempt,
  resolveSubmitFailure,
  useAnswerQuestion,
  useStartAttempt,
  useSubmitAnswer,
} from '@/features/student/exercises/api/use-attempt';
import {
  PRACTICE_ACCENT,
  readShortAnswerProjection,
  ShortAnswerBody,
  type ShortAnswerPhase,
  type ShortAnswerTally,
} from '@/features/student/exercises/runner';
import type { AttemptRecord, ResumedAnswer } from '@/features/student/exercises/types/attempts';
import type {
  ProjectedQuestion,
  StudentProjection,
  StudentResult,
} from '@/lib/shared-kernel/short-answer';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface ShortAnswerSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** Fired once, when the set is closed. `null` when a teacher has it. */
  onChecked?: (ok: boolean | null) => void;
  /**
   * True when the set is one card in a stack of tasks rather than the whole screen.
   * The stack draws its own progress over the section, so the set drops its own bar and
   * keeps only the counter that says which question is open.
   */
  stacked?: boolean;
}

const EMPTY_TALLY: ShortAnswerTally = { pass: 0, partial: 0, fail: 0 };

/**
 * `short_answer` played against the server, a question at a time.
 *
 * The set is walked question by question: write, hand in, read the verdict, move on with
 * no way back. Every verdict on the screen came from the engine, because the key is a
 * set of anchor phrases — the answer written in the words the student is being asked to
 * find — and a browser holding it would be holding the answers (plan 51 §3.2).
 *
 * The attempt is still one attempt. Each answer is a command onto it
 * (`POST .../answers`), and the last one closes it with `submit`, which sends every
 * answer in one aggregate and regrades all of them from scratch: a verdict that reached
 * the client is a verdict a client could send back, so none of them is trusted at the
 * close (plan 51 §3.3).
 *
 * A reload continues the set rather than replaying it (plan 51 §8 Q6). The engine hands
 * back an open attempt that already holds answers instead of reporting the conflict the
 * caller would resolve by abandoning it, so the runner picks up at the first question
 * with nothing on it, carrying the earlier answers and their verdicts. What that buys is
 * the rule the spec asks for: a question handed in is handed in, and a reload is not a
 * way to answer it again.
 *
 * A set found fully answered but never closed — a `submit` that did not land — closes
 * itself on arrival instead of showing a screen with nothing left to do on it.
 */
export function ShortAnswerSolver({
  exerciseId,
  instruction,
  language,
  onChecked,
  stacked = false,
}: ShortAnswerSolverProps) {
  const t = useTranslations('ExerciseRunner');

  const start = useStartAttempt(exerciseId);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [projection, setProjection] = useState<StudentProjection | null>(null);
  /** Set when the set arrived with its answer key still on it — see the projection reader. */
  const [unusable, setUnusable] = useState(false);

  const answer = useAnswerQuestion<StudentResult>(exerciseId, attemptId);
  const submit = useSubmitAnswer(exerciseId, attemptId);

  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<ShortAnswerPhase>('writing');
  const [result, setResult] = useState<StudentResult | null>(null);
  const [tally, setTally] = useState<ShortAnswerTally>(EMPTY_TALLY);
  const [error, setError] = useState<string | null>(null);
  /**
   * The teacher's verdict on the *previous* attempt, once one has read it. Set only on
   * the very first `begin()` (see `reviewConsidered` below) — `useStartAttempt` always
   * hands back a fresh or resumed *live* attempt, never the one a teacher already closed,
   * so this is read separately and shown in its place until the learner asks to redo it.
   */
  const [review, setReview] = useState<AttemptReview | null>(null);

  /** Every answer handed in, in order — the aggregate `submit` closes the attempt with. */
  const answers = useRef<Array<{ questionId: string; text: string }>>([]);
  /** Wall-clock since the attempt opened; the engine records it per submission. */
  const openedAt = useRef(0);
  /**
   * The one-time read of the previous attempt's verdict. Without this guard, `restart()`
   * calling `begin()` again would read the same closed attempt back — `fetchLastAttempt`
   * has nothing newer to report until the fresh attempt this screen is about to start is
   * itself submitted — and immediately re-show the recap the learner just asked past.
   */
  const reviewConsidered = useRef(false);
  /**
   * Bumped when a resumed attempt turns out to hold every answer and only needs closing.
   * A counter rather than a flag so a second resume — the close failed and the learner
   * asked again — is a new arrival rather than the same one already dealt with.
   */
  const [arrival, setArrival] = useState(0);
  /** The arrival already closed, so an effect re-run cannot submit the set twice. */
  const closedArrival = useRef(0);

  /**
   * Pick up a set where it was left, from what the engine says is already in.
   *
   * The verdicts come back with the answers, so the tally is the one the learner was
   * shown rather than a recount, and the earlier answers go back into the aggregate the
   * closing `submit` sends — leaving them out would hand in a set missing everything
   * answered before the reload. Unknown ids are dropped: the key can be edited between
   * sittings, and a question that no longer exists is not one to walk back to.
   */
  const resume = useCallback((set: StudentProjection, answered: ResumedAnswer[]) => {
    const known = answered.filter((a) => set.questions.some((q) => q.id === a.questionId));

    answers.current = known.map(({ questionId, text }) => ({ questionId, text }));
    setTally(
      known.reduce<ShortAnswerTally>(
        (counts, a) => ({ ...counts, [a.verdict]: counts[a.verdict] + 1 }),
        EMPTY_TALLY,
      ),
    );
    setResult(null);
    setValue('');
    setError(null);

    const handedIn = new Set(known.map((a) => a.questionId));
    const next = set.questions.findIndex((q) => !handedIn.has(q.id));

    if (next === -1) {
      // Every question is in and the attempt is still open: the close is what is missing.
      setIndex(Math.max(0, set.questions.length - 1));
      if (known.length > 0) setArrival((n) => n + 1);
      return;
    }

    setIndex(next);
    setPhase('writing');
  }, []);

  const startMutate = start.mutate;
  const begin = useCallback(() => {
    startMutate(
      { language },
      {
        onSuccess: async (data) => {
          const set = readShortAnswerProjection(data.exerciseContent);
          if (set === null) {
            setUnusable(true);
            return;
          }

          setAttemptId(data.attemptId);
          setProjection(set);
          openedAt.current = Date.now();
          resume(set, data.answeredQuestions ?? []);

          if (reviewConsidered.current) return;
          reviewConsidered.current = true;

          const saved = await fetchLastAttempt(exerciseId);
          // A string, not merely "not null": an attempt read back from an engine that
          // predates review carries no such field at all.
          if (saved !== null && typeof saved.reviewedAt === 'string') {
            setReview(readReview(saved));
          }
        },
      },
    );
  }, [startMutate, language, resume, exerciseId]);

  useEffect(() => {
    begin();
  }, [begin]);

  const retry = useCallback(() => {
    setUnusable(false);
    begin();
  }, [begin]);

  const submitMutate = submit.mutate;
  /**
   * Close the set: the last `Ferdig` submits every answer at once.
   *
   * The verdicts collected along the way are not sent — the validator recomputes all of
   * them from the text and the current key, which is what makes the score, the routing
   * and the teacher's breakdown independent of anything this browser decided.
   *
   * A callback rather than a plain function because a resumed set can arrive with
   * nothing left to answer, and closing it is then an effect rather than a click.
   */
  const closeSet = useCallback(() => {
    if (attemptId === null) return;
    const openAttemptId = attemptId;
    setPhase('done');

    submitMutate(
      {
        submittedAnswer: { answers: answers.current },
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
      },
      {
        onSuccess: (data) => onChecked?.(data.requiresReview ? null : data.correct),
        onError: async () => {
          // The work may well have landed: the engine accepts a submission before it
          // scores or routes it, so a lost response is not a lost set. Asking is the only
          // way to tell, and the answer decides what the exercise is marked as.
          const resolution = await resolveSubmitFailure(exerciseId, openAttemptId);
          if (resolution === 'delivered') onChecked?.(null);
          else setError(t('shortAnswer.closeFailed'));
        },
      },
    );
  }, [attemptId, exerciseId, onChecked, submitMutate, t]);

  // A set resumed with every question already in needs no screen — it needs closing.
  useEffect(() => {
    if (arrival === 0 || arrival === closedArrival.current || attemptId === null) return;
    closedArrival.current = arrival;
    closeSet();
  }, [arrival, attemptId, closeSet]);

  if (!unusable && (start.isPending || (start.isSuccess && projection === null))) {
    return <LearningSkeleton variant="list" rows={4} />;
  }
  if (unusable || start.isError || projection === null || attemptId === null) {
    return <ErrorState onRetry={retry} />;
  }

  // The reader owns the instruction line — it is translated per learner, while the
  // projection carries the author's own, in the language being learned. One or the
  // other, never both above every question (plan 50's rule for `writing_task`, and the
  // answer to plan 51 phase 3's open question).
  const set =
    instruction === undefined || instruction === '' ? projection : { ...projection, instruction };

  // Captured out of state: the guard above narrowed both, but a hoisted function
  // declaration does not carry that narrowing into its body.
  const { questions } = projection;
  const question = questions[index];

  function hand() {
    if (question === undefined || answer.isPending) return;
    const { id: questionId } = question;
    setError(null);

    answer.mutate(
      { questionId, text: value },
      {
        onSuccess: (data) => {
          answers.current = [...answers.current, { questionId, text: value }];
          setResult(data.result);
          setTally((counts) => ({
            ...counts,
            [data.result.verdict]: counts[data.result.verdict] + 1,
          }));
          setPhase('submitted');
        },
        // A refusal the engine will keep making (this question is already in, the attempt
        // is closed) reads the same to the learner as a network failure — but only one of
        // them is worth pressing the button again for, so they are told apart.
        onError: (e) =>
          setError(
            e instanceof AttemptRequestError && e.status === 422
              ? t('shortAnswer.handedInAlready')
              : t('shortAnswer.sendFailed'),
          ),
      },
    );
  }

  function next() {
    setResult(null);
    setValue('');
    setError(null);

    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setPhase('writing');
      return;
    }
    closeSet();
  }

  /**
   * Start the set over — a new attempt, not an edit of the closed one.
   *
   * The answers already handed in stay where they were written, on the attempt a teacher
   * may be reading; this walks the questions again from the first.
   */
  function restart() {
    setIndex(0);
    setValue('');
    setResult(null);
    setTally(EMPTY_TALLY);
    setError(null);
    setPhase('writing');
    setReview(null);
    answers.current = [];
    begin();
  }

  return (
    <div>
      {review !== null ? (
        <ShortAnswerReviewRecap review={review} projection={projection} onAgain={restart} />
      ) : (
        <ShortAnswerBody
          set={set}
          index={index}
          value={value}
          onValueChange={setValue}
          phase={phase}
          result={result}
          tally={tally}
          sending={answer.isPending}
          error={error}
          onSubmit={hand}
          onNext={next}
          onRestart={restart}
          showProgressBar={!stacked}
          accent={PRACTICE_ACCENT}
        />
      )}
    </div>
  );
}

/** What a teacher decided about one question, once one has read the submission. */
interface ShortAnswerItemVerdict {
  approved: boolean;
  comment?: string;
}

/** The teacher's decisions, by question. */
type ShortAnswerVerdicts = Record<string, ShortAnswerItemVerdict>;

/** The teacher's verdict on the previous attempt, as this screen holds it. */
interface AttemptReview {
  status: AttemptRecord['status'];
  score: number | null;
  comment: string | null;
  verdicts: ShortAnswerVerdicts;
  /** questionId → the learner's own text on that closed attempt. */
  answers: Record<string, string>;
}

/**
 * The teacher's verdict, out of the attempt record.
 *
 * Read rather than trusted wholesale: the decisions and the submitted answer are both
 * JSON columns upstream, and a shape this screen cannot read is one it should show
 * nothing for rather than crash on.
 */
function readReview(attempt: AttemptRecord): AttemptReview {
  const verdicts: ShortAnswerVerdicts = {};
  for (const decision of attempt.reviewDecisions ?? []) {
    if (typeof decision?.itemId !== 'string') continue;
    verdicts[decision.itemId] = {
      approved: decision.approved === true,
      ...(typeof decision.comment === 'string' && decision.comment.trim() !== ''
        ? { comment: decision.comment }
        : {}),
    };
  }

  const answers: Record<string, string> = {};
  const raw = attempt.submittedAnswer as { answers?: unknown } | null;
  if (raw !== null && typeof raw === 'object' && Array.isArray(raw.answers)) {
    for (const entry of raw.answers) {
      if (typeof entry?.questionId === 'string' && typeof entry?.text === 'string') {
        answers[entry.questionId] = entry.text;
      }
    }
  }

  return {
    status: attempt.status,
    score: attempt.score,
    comment:
      typeof attempt.reviewComment === 'string' && attempt.reviewComment.trim() !== ''
        ? attempt.reviewComment
        : null,
    verdicts,
    answers,
  };
}

/**
 * The previous attempt's verdict, read-only — what stands in for the writing form until
 * the learner asks to redo it (plan 47 §4.1).
 *
 * Only the questions a teacher actually decided on are listed: the rest were either
 * accepted outright by the auto-check or never reached a person, and this screen has no
 * honest way to tell those two apart from here — showing nothing for them beats
 * guessing. The reference each one was checked against never appears; only the position
 * in the set and, where the teacher wrote one, the words they chose to explain it with.
 */
function ShortAnswerReviewRecap({
  review,
  projection,
  onAgain,
}: {
  review: AttemptReview;
  projection: StudentProjection;
  onAgain: () => void;
}) {
  const t = useTranslations('ExerciseRunner');
  const decided = projection.questions
    .map((question) => ({ question, verdict: review.verdicts[question.id] }))
    .filter(
      (entry): entry is { question: ProjectedQuestion; verdict: ShortAnswerItemVerdict } =>
        entry.verdict !== undefined,
    );

  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{
        borderColor:
          review.status === 'RETURNED'
            ? 'var(--ssz-border-default)'
            : 'var(--ssz-feedback-ok-line)',
        background:
          review.status === 'RETURNED'
            ? 'var(--ssz-bg-surface-subtle)'
            : 'var(--ssz-feedback-ok-bg)',
      }}
    >
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
          ? t('shortAnswer.review.sentBack')
          : t('shortAnswer.review.marked')}
      </p>
      {review.status !== 'RETURNED' && review.score !== null && (
        <p className="mt-1 text-[12.5px] text-(--ssz-text-secondary)">
          {t('shortAnswer.review.score', { score: review.score })}
        </p>
      )}
      {/* The teacher's own words about the submission as a whole, where they wrote any. */}
      {review.comment !== null && (
        <p className="mt-2 text-[13px] text-(--ssz-text-primary)">{review.comment}</p>
      )}

      {decided.length > 0 && (
        <ol className="mt-3 flex flex-col gap-2.5 border-t pt-3" style={{ borderColor: 'var(--ssz-border-default)' }}>
          {decided.map(({ question, verdict }, index) => {
            const answer = review.answers[question.id];
            return (
              <li key={question.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-bold text-(--ssz-text-muted)">
                    {t('shortAnswer.position', { n: index + 1, total: decided.length })}
                  </span>
                  <span
                    className="text-[12px] font-semibold"
                    style={{
                      color: verdict.approved
                        ? 'var(--ssz-feedback-ok-fg)'
                        : 'var(--ssz-feedback-no-fg)',
                    }}
                  >
                    {verdict.approved
                      ? t('shortAnswer.review.itemCounted')
                      : t('shortAnswer.review.itemNotCounted')}
                  </span>
                </div>
                <p className="text-[13.5px] font-semibold">{question.prompt}</p>
                {answer !== undefined && answer.trim() !== '' && (
                  <p className="mt-0.5 text-[13px] text-(--ssz-text-secondary)">{answer}</p>
                )}
                {verdict.comment !== undefined && verdict.comment.trim() !== '' ? (
                  <p className="mt-1 text-[12.5px] text-(--ssz-text-secondary)">
                    {verdict.comment}
                  </p>
                ) : (
                  !verdict.approved && (
                    <p className="mt-1 text-[12.5px] text-(--ssz-text-muted)">
                      {t('shortAnswer.review.itemNotCountedPlain')}
                    </p>
                  )
                )}
              </li>
            );
          })}
        </ol>
      )}

      <button
        type="button"
        onClick={onAgain}
        className="mt-3 text-[12.5px] font-semibold underline underline-offset-2"
        style={{ color: 'var(--ssz-text-secondary)' }}
      >
        {t('shortAnswer.done.again')}
      </button>
    </div>
  );
}
