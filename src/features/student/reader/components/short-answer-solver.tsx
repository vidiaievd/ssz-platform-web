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
 * What the runner cannot do is resume. Re-opening an exercise abandons an attempt that
 * has nothing submitted and starts a fresh one — the behaviour every other template
 * wants, since their unfinished work only ever lived in the browser — and the answers
 * already handed in stay on the abandoned row, unread by this screen. So a reload starts
 * the set over. Nothing is lost and nothing is double-counted, but "irreversible" holds
 * within a sitting rather than across one, and closing that gap means teaching the
 * engine to hand the answered questions back (plan 51 §7, phase 4 follow-up).
 */
export function ShortAnswerSolver({
  exerciseId,
  instruction,
  language,
  onChecked,
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
          answers.current = [];
        },
      },
    );
  }, [startMutate, language]);

  useEffect(() => {
    begin();
  }, [begin]);

  const retry = useCallback(() => {
    setUnusable(false);
    begin();
  }, [begin]);

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
  const openAttemptId = attemptId;
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

  /**
   * Close the set: the last `Ferdig` submits every answer at once.
   *
   * The verdicts collected along the way are not sent — the validator recomputes all of
   * them from the text and the current key, which is what makes the score, the routing
   * and the teacher's breakdown independent of anything this browser decided.
   */
  function close() {
    setPhase('done');

    submit.mutate(
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
    close();
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
        accent={PRACTICE_ACCENT}
      />
    </div>
  );
}
