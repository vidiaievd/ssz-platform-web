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
  MultipleChoiceBody,
  PRACTICE_ACCENT,
  readMultipleChoiceProjection,
  type MultipleChoicePhase,
} from '@/features/student/exercises/runner';
import type { MultipleChoiceResult, ResumedPick } from '@/features/student/exercises/types/attempts';
import type { StudentProjection } from '@/lib/shared-kernel/multiple-choice';
import { useExerciseAudio } from '@/features/student/exercises/audio';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface MultipleChoiceSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** Fired once, when the set is closed. */
  onChecked?: (ok: boolean | null) => void;
  /**
   * True when the set is one card in a stack of tasks rather than the whole screen. The
   * stack draws its own progress over the section, so the set drops its own bar and keeps
   * only the counter that says which question is open.
   */
  stacked?: boolean;
}

/**
 * `multiple_choice` played against the server, a question at a time.
 *
 * Nothing on this screen knows which option is right. The pick goes up and the verdict
 * comes down, dosed by how the question stands: a wrong pick with a try left comes back
 * with a rebuttal and nothing else, and only a closed question carries `keyOptionId` and
 * the rule behind it. That dosing is the type — a retry and a 50/50 offered by a browser
 * that already holds the key are decoration (plan 53 §3.2).
 *
 * The attempt is still one attempt. Each pick is a command onto it (`POST .../answers`),
 * and the last question closes it with `submit`. The aggregate sent there is empty on
 * purpose: the engine rebuilds the list from the picks it recorded, because **which try a
 * question was taken on is the score** and a client that sent its own attempt numbers
 * would be scoring itself (plan 53 §5).
 *
 * A reload continues the set rather than replaying it. The engine hands back an open
 * attempt with its picks on it, so the runner reopens at the first question that is not
 * closed, carrying the tries already spent and the options the 50/50 already took away.
 * Without that, a reload after a miss would be a fresh first try at every question — the
 * cheapest possible full score.
 */
export function MultipleChoiceSolver({
  exerciseId,
  instruction,
  language,
  onChecked,
  stacked = false,
}: MultipleChoiceSolverProps) {
  const t = useTranslations('ExerciseRunner');

  const start = useStartAttempt(exerciseId);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [projection, setProjection] = useState<StudentProjection | null>(null);
  /**
   * The document as the engine dealt it, kept for the audio layer alone.
   *
   * The projection above is the kernel's own shape and has no room for a block that is
   * not the template's — so the audio is read off the document the attempt arrived with
   * (plan 56). An exercise with no audio leaves this holding a document with no `audio`
   * key, which the engine reads as switched off.
   */
  const [document, setDocument] = useState<unknown>(null);
  /** What the clip said, once the engine hands it over with the last verdict. */
  const [transcript, setTranscript] = useState<{ transcript: string; translation: string } | null>(
    null,
  );
  /** Set when the set arrived with its answer key still on it — see the projection reader. */
  const [unusable, setUnusable] = useState(false);

  const answer = useAnswerQuestion<MultipleChoiceResult>(exerciseId, attemptId);
  const submit = useSubmitAnswer(exerciseId, attemptId);

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [phase, setPhase] = useState<MultipleChoicePhase>('picking');
  const [result, setResult] = useState<MultipleChoiceResult | null>(null);
  /** Which try the open question is on. Held here because a retry clears the verdict. */
  const [attempt, setAttempt] = useState(1);
  /** What the 50/50 has taken away on the open question; survives `Prøv igjen`. */
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /** Wall-clock since the attempt opened; the engine records it per submission. */
  const openedAt = useRef(0);
  /**
   * Bumped when a resumed attempt turns out to have every question closed and only needs
   * submitting. A counter rather than a flag so a second resume — the close failed and the
   * learner asked again — is a new arrival rather than the same one already dealt with.
   */
  const [arrival, setArrival] = useState(0);
  /** The arrival already closed, so an effect re-run cannot submit the set twice. */
  const closedArrival = useRef(0);

  /**
   * Pick up a set where it was left, from what the engine says is already on the attempt.
   *
   * The score is recounted here rather than carried: a question is worth a point when it
   * came out right on the first pick, which `picks.length === 1` says exactly. Unknown ids
   * are dropped — the document can be edited between sittings, and a question that no
   * longer exists is not one to walk back to.
   */
  const resume = useCallback((set: StudentProjection, picks: ResumedPick[]) => {
    const known = picks.filter((p) => set.questions.some((q) => q.id === p.questionId));

    setScore(known.filter((p) => p.correct && p.picks.length === 1).length);
    setResult(null);
    setPicked(null);
    setEliminated([]);
    setError(null);

    const closed = new Set(known.filter((p) => p.closed).map((p) => p.questionId));
    const next = set.questions.findIndex((q) => !closed.has(q.id));

    if (next === -1) {
      // Every question is closed and the attempt is still open: the submit is what is
      // missing.
      setIndex(Math.max(0, set.questions.length - 1));
      setPhase('picking');
      if (known.length > 0) setArrival((n) => n + 1);
      return;
    }

    // The open question may still have tries on it — a reload between a miss and the
    // retry. The pick itself is not restored: it was judged and the judgement is gone,
    // so the question reopens on the try it had reached.
    const open = known.find((p) => p.questionId === set.questions[next]!.id);
    setIndex(next);
    setAttempt(Math.max(1, (open?.picks.length ?? 0) + 1));
    setEliminated(open?.eliminated ?? []);
    setPhase('picking');
  }, []);

  const startMutate = start.mutate;
  const begin = useCallback(() => {
    startMutate(
      { language },
      {
        onSuccess: (data) => {
          const set = readMultipleChoiceProjection(data.exerciseContent);
          if (set === null) {
            setUnusable(true);
            return;
          }

          setAttemptId(data.attemptId);
          setProjection(set);
          setDocument(data.exerciseContent);
          setTranscript(null);
          openedAt.current = Date.now();
          resume(set, data.pickedOptions ?? []);
        },
      },
    );
  }, [startMutate, language, resume]);

  useEffect(() => {
    begin();
  }, [begin]);

  const retryStart = useCallback(() => {
    setUnusable(false);
    begin();
  }, [begin]);

  const submitMutate = submit.mutate;
  /**
   * Close the set: the last `Ferdig` submits the attempt.
   *
   * The picks are not sent. The engine replaces whatever arrives with what it recorded
   * through `answer-question`, so an empty aggregate is not a shortcut here but the
   * honest shape of the request — everything it would carry is already on the attempt,
   * and the one field a client could get wrong (which try a question was taken on) is the
   * score itself.
   *
   * A callback rather than a plain function because a resumed set can arrive with nothing
   * left to answer, and closing it is then an effect rather than a click.
   */
  const closeSet = useCallback(() => {
    if (attemptId === null) return;
    const openAttemptId = attemptId;
    setPhase('done');

    submitMutate(
      {
        submittedAnswer: { answers: [] },
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
      },
      {
        onSuccess: (data) => onChecked?.(data.requiresReview ? null : data.correct),
        onError: async () => {
          // The work may well have landed: the engine accepts a submission before it
          // scores it, so a lost response is not a lost set. Asking is the only way to
          // tell, and the answer decides what the exercise is marked as.
          const resolution = await resolveSubmitFailure(exerciseId, openAttemptId);
          if (resolution === 'delivered') onChecked?.(null);
          else setError(t('multipleChoice.closeFailed'));
        },
      },
    );
  }, [attemptId, exerciseId, onChecked, submitMutate, t]);

  // A set resumed with every question closed needs no screen — it needs submitting.
  useEffect(() => {
    if (arrival === 0 || arrival === closedArrival.current || attemptId === null) return;
    closedArrival.current = arrival;
    closeSet();
  }, [arrival, attemptId, closeSet]);

  /**
   * The listening layer, if this set has one.
   *
   * Mounted above the early returns because a hook cannot be conditional, and mounted
   * once for the whole set rather than per question: the allowance, the gate and the
   * playthrough belong to the exercise, and one engine per question would hand out one
   * listen per question (INTEGRATION.md, "Validation + runner").
   */
  const audio = useExerciseAudio(document);

  if (!unusable && (start.isPending || (start.isSuccess && projection === null))) {
    return <LearningSkeleton variant="list" rows={4} />;
  }
  if (unusable || start.isError || projection === null || attemptId === null) {
    return <ErrorState onRetry={retryStart} />;
  }

  // The reader owns the instruction line — it is translated per learner, while the
  // projection carries the author's own, in the language being learned. One or the other,
  // never both above every question (plan 53 §5).
  const set =
    instruction === undefined || instruction === '' ? projection : { ...projection, instruction };

  const { questions } = projection;
  const question = questions[index];

  /**
   * Hand one pick in, or ask to be shown the answer.
   *
   * The verdict decides everything that follows, including whether the question is over:
   * `closed` is the server's word, not a count kept here. What is kept here is the running
   * score, and only because the completion card shows it before `submit` answers — the
   * score that counts is recomputed there from the attempt.
   */
  function send(optionId: string | null, reveal = false) {
    if (question === undefined || answer.isPending) return;
    const { id: questionId } = question;
    setError(null);

    answer.mutate(
      { questionId, optionId, ...(reveal ? { reveal: true } : {}) },
      {
        onSuccess: (data) => {
          const verdict = data.result;
          setResult(verdict);
          setPicked(verdict.optionId === '' ? null : verdict.optionId);
          setAttempt(Math.max(1, verdict.attempt));
          if (verdict.eliminated !== undefined) setEliminated(verdict.eliminated);
          if (verdict.correct && verdict.attempt === 1) setScore((n) => n + 1);
          // The last question closed, so the clip has nothing left to give away and the
          // engine hands over what it said (plan 56 §3.3).
          if (data.audioTranscript !== undefined) setTranscript(data.audioTranscript);
          setPhase('judged');
        },
        // A refusal the engine will keep making (this question is closed, the attempt is
        // over) reads the same to the learner as a network failure — but only one of them
        // is worth pressing the button again for, so they are told apart.
        onError: (e) =>
          setError(
            e instanceof AttemptRequestError && e.status === 422
              ? t('multipleChoice.closedAlready')
              : t('multipleChoice.sendFailed'),
          ),
      },
    );
  }

  /**
   * Tap an option.
   *
   * Under `instant` the tap is the hand-in. Otherwise it only arms `Sjekk`, and a tap
   * while a wrong pick is still open re-arms it: the judgement is dropped and the pick
   * changes, which is the handoff's "re-picking clears the judgement" rule. The try is
   * not spent by that — only `Prøv igjen` spends one.
   */
  function pick(optionId: string) {
    if (phase === 'judged' && result?.closed === true) return;
    if (set.settings.instant) {
      setPicked(optionId);
      send(optionId);
      return;
    }
    if (phase === 'judged') {
      setResult(null);
      setPhase('picking');
    }
    setPicked(optionId);
  }

  function retryQuestion() {
    setResult(null);
    setPicked(null);
    setAttempt((n) => n + 1);
    setPhase('picking');
  }

  function next() {
    setResult(null);
    setPicked(null);
    setAttempt(1);
    setEliminated([]);
    setError(null);

    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setPhase('picking');
      return;
    }
    closeSet();
  }

  /**
   * Start the set over — a new attempt, not an edit of the closed one.
   *
   * The picks already made stay where they were recorded, on the attempt that was scored;
   * this walks the questions again from the first.
   */
  function restart() {
    setIndex(0);
    setPicked(null);
    setResult(null);
    setAttempt(1);
    setEliminated([]);
    setScore(0);
    setError(null);
    setPhase('picking');
    begin();
  }

  return (
    <div>
      <MultipleChoiceBody
        set={set}
        index={index}
        picked={picked}
        onPick={pick}
        phase={phase}
        result={result}
        attempt={attempt}
        eliminated={eliminated}
        score={score}
        sending={answer.isPending}
        error={error}
        audio={audio}
        audioTranscript={transcript}
        onCheck={() => send(picked)}
        onRetry={retryQuestion}
        onReveal={() => send(null, true)}
        onNext={next}
        onRestart={restart}
        showProgressBar={!stacked}
        accent={PRACTICE_ACCENT}
      />
    </div>
  );
}
