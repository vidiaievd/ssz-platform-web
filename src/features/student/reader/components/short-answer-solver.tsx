'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  AttemptRequestError,
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
import type { ResumedAnswer } from '@/features/student/exercises/types/attempts';
import type { StudentProjection, StudentResult } from '@/lib/shared-kernel/short-answer';
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

  const answer = useAnswerQuestion(exerciseId, attemptId);
  const submit = useSubmitAnswer(exerciseId, attemptId);

  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<ShortAnswerPhase>('writing');
  const [result, setResult] = useState<StudentResult | null>(null);
  const [tally, setTally] = useState<ShortAnswerTally>(EMPTY_TALLY);
  const [error, setError] = useState<string | null>(null);

  /** Every answer handed in, in order — the aggregate `submit` closes the attempt with. */
  const answers = useRef<Array<{ questionId: string; text: string }>>([]);
  /** Wall-clock since the attempt opened; the engine records it per submission. */
  const openedAt = useRef(0);
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
        onSuccess: (data) => {
          const set = readShortAnswerProjection(data.exerciseContent);
          if (set === null) {
            setUnusable(true);
            return;
          }

          setAttemptId(data.attemptId);
          setProjection(set);
          openedAt.current = Date.now();
          resume(set, data.answeredQuestions ?? []);
        },
      },
    );
  }, [startMutate, language, resume]);

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
    answers.current = [];
    begin();
  }

  return (
    <div>
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
    </div>
  );
}
