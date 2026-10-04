'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  AttemptRequestError,
  resolveSubmitFailure,
  useStartAttempt,
  useSubmitAnswer,
} from '@/features/student/exercises/api/use-attempt';
import {
  extendMark,
  HighlightInTextBody,
  keepExact,
  PRACTICE_ACCENT,
  readHighlightInTextProjection,
  toggleMark,
  toWire,
} from '@/features/student/exercises/runner';
import type {
  HighlightInTextQuestionState,
  HighlightInTextSubmitDetails,
  HighlightInTextSubmittedAnswer,
} from '@/features/student/exercises/types/attempts';
import {
  paragraphOfTokens,
  tokenize,
  type StudentProjection,
  type TokenRun,
} from '@/lib/shared-kernel/highlight-in-text';
import { useExerciseAudio } from '@/features/student/exercises/audio';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface HighlightInTextSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** Fired once, when the last question closes — the submit the evidence is written on. */
  onChecked?: (ok: boolean | null) => void;
  /** On the shared solver signature, unread: the passage draws its own question rail. */
  stacked?: boolean;
}

/**
 * `highlight_in_text` played against the server: a passage, and up to four questions
 * answered one at a time in one attempt (plan 67, Q1-A).
 *
 * Nothing on this screen knows which words are right. The marks go up as character offsets
 * and the verdict comes down, dosed by how the question stands: a check returns the student's
 * own marks with their states and a *count* of what was missed (AC-S5); only a reveal returns
 * the key with its reasons (AC-S9).
 *
 * Every submit — a check, a retry, the next question, a reveal — goes to the same attempt.
 * The engine keeps it open until the last question closes, carries every question's state
 * itself and writes it over anything a client might send, so none of it is sent from here;
 * what is kept here is only what the screen needs:
 *
 *   * **`states`** — the server's word on every question, from the last response (or the
 *     resumed attempt). The rail and «which question next» are drawn from it.
 *   * **`verdict`** — the last submit of the question on screen; `null` while marking.
 *   * **`attempt`** — the check the question is *on*, which a retry moves past the last one
 *     before the server has been asked anything.
 *
 * **A closed question is closed even with checks left.** A pass and a reveal leave checks
 * unspent and the engine refuses another on either, so `verdict.closed` decides the buttons.
 *
 * **Reload resumes.** A start that finds this learner's open attempt returns it with
 * `questionStates`; the runner opens on the first question still open, at the check after
 * the last one made. Marks in an unchecked question were never on the server and are not
 * restored.
 */
export function HighlightInTextSolver({
  exerciseId,
  instruction,
  language,
  onChecked,
}: HighlightInTextSolverProps) {
  const t = useTranslations('ExerciseRunner.highlightInText');

  const start = useStartAttempt(exerciseId);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [projection, setProjection] = useState<StudentProjection | null>(null);
  /** The document as the engine dealt it, kept for the audio layer alone (plan 56). */
  const [document, setDocument] = useState<unknown>(null);
  const [transcript, setTranscript] = useState<{ transcript: string; translation: string } | null>(
    null,
  );
  /** Set when the passage arrived with its key still on it — see the projection reader. */
  const [unusable, setUnusable] = useState(false);

  const submit = useSubmitAnswer(exerciseId, attemptId);

  const [states, setStates] = useState<HighlightInTextQuestionState[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [marks, setMarks] = useState<TokenRun[]>([]);
  const [verdict, setVerdict] = useState<HighlightInTextSubmitDetails | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [startFailed, setStartFailed] = useState(false);

  /** Wall-clock since the attempt opened; the engine records it per submission. */
  const openedAt = useRef(0);
  /** So progress is reported once — on the submit that closes the attempt. */
  const reported = useRef(false);

  const text = projection?.text ?? '';
  const tokens = useMemo(() => tokenize(text), [text]);
  const paragraphOf = useMemo(() => paragraphOfTokens(text, tokens), [text, tokens]);

  const startAsync = start.mutateAsync;
  const begin = useCallback(() => {
    // A promise, not `mutate(vars, { onSuccess })`: the per-call callbacks belong to the
    // mutation observer, and when React re-mounts the component (strict mode) the observer
    // lets go of them — the start would succeed and nothing would ever read its answer.
    // For the same reason the screen does not read `start.isPending` / `start.isError`: an
    // observer that was let go stops hearing about the mutation. The solver keeps its own.
    setStartFailed(false);
    startAsync({ language })
      .then((data) => {
        const passage = readHighlightInTextProjection(data.exerciseContent);
        if (passage === null) {
          setUnusable(true);
          return;
        }

        const resumed = data.questionStates ?? [];
        const open = passage.questions.findIndex(
          (q) => resumed.find((s) => s.questionId === q.id)?.closed !== true,
        );
        const at = open === -1 ? 0 : open;
        const here = resumed.find((s) => s.questionId === passage.questions[at]?.id);

        setAttemptId(data.attemptId);
        setProjection(passage);
        setDocument(data.exerciseContent);
        setTranscript(null);
        setStates(resumed);
        setQuestionIndex(at);
        setMarks([]);
        setVerdict(null);
        setAttempt((here?.checks ?? 0) + 1);
        setError(null);
        openedAt.current = Date.now();
      })
      .catch(() => setStartFailed(true));
  }, [startAsync, language]);

  // Once per mount. React's dev double-run of effects would otherwise send two starts a
  // millisecond apart, and the engine — which checks for an open attempt and then inserts —
  // writes both, leaving a second `in_progress` row nobody will ever finish (plan 67, ph. 9).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    begin();
  }, [begin]);

  const retryStart = useCallback(() => {
    setUnusable(false);
    begin();
  }, [begin]);

  const audio = useExerciseAudio(document);

  if (!unusable && !startFailed && projection === null) {
    return <LearningSkeleton variant="list" rows={4} />;
  }
  if (unusable || startFailed || projection === null || attemptId === null) {
    return <ErrorState onRetry={retryStart} />;
  }

  const question = projection.questions[questionIndex];
  const completed = projection.questions.map(
    (q) => states.find((s) => s.questionId === q.id)?.closed === true,
  );

  /** Hand the question's marks in, or ask to be shown its key. */
  function send(reveal = false) {
    if (attemptId === null || question === undefined || submit.isPending) return;
    setError(null);

    const answer: HighlightInTextSubmittedAnswer = {
      questionId: question.id,
      marks: reveal ? [] : toWire(marks, tokens),
      ...(reveal ? { reveal: true as const } : {}),
    };
    const openAttemptId = attemptId;

    submit.mutate(
      {
        submittedAnswer: answer,
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
      },
      {
        onSuccess: (data) => {
          const details = data.details as HighlightInTextSubmitDetails | undefined;
          if (
            details === undefined ||
            !Array.isArray(details.cells) ||
            !Array.isArray(details.questions)
          ) {
            setError(t('sendFailed'));
            return;
          }

          setVerdict(details);
          setStates(details.questions);
          setAttempt(details.attempt);
          if (data.audioTranscript !== undefined) setTranscript(data.audioTranscript);

          // Once, and when the attempt closes: that submit is the one the engine scores and
          // publishes evidence on, with every question's first check in it.
          if (details.complete && !reported.current) {
            reported.current = true;
            onChecked?.(data.requiresReview ? null : details.attemptPassed);
          }
        },
        onError: async (e) => {
          // A refusal the engine will keep making — this question is closed — reads the
          // same as a lost request, but only one of them is worth pressing again for.
          if (e instanceof AttemptRequestError && e.status === 422) {
            setError(t('closedAlready'));
            return;
          }
          const resolution = await resolveSubmitFailure(exerciseId, openAttemptId);
          setError(resolution === 'delivered' ? t('closedAlready') : t('sendFailed'));
        },
      },
    );
  }

  function mark(origin: number, end: number) {
    if (question === undefined) return;
    setMarks((current) => toggleMark(current, origin, end, question.unit, paragraphOf));
  }

  function extend(i: number, delta: 1 | -1) {
    if (question?.unit !== 'phrase') return;
    setMarks((current) => extendMark(current, i, delta, paragraphOf));
  }

  /** «Prøv på nytt» — exactly the right marks stay (AC-S6), and the check moves on. */
  function retry() {
    if (verdict === null) return;
    setMarks((current) => keepExact(current, verdict.cells, tokens));
    setAttempt(verdict.attempt + 1);
    setVerdict(null);
    setError(null);
  }

  /** «Neste spørsmål» — the next question still open, at the check after its last. */
  function next() {
    if (projection === null) return;
    const ahead = projection.questions.findIndex(
      (q, i) => i > questionIndex && states.find((s) => s.questionId === q.id)?.closed !== true,
    );
    if (ahead === -1) return;
    const here = states.find((s) => s.questionId === projection.questions[ahead]?.id);
    setQuestionIndex(ahead);
    setMarks([]);
    setVerdict(null);
    setAttempt((here?.checks ?? 0) + 1);
    setError(null);
  }

  // The reader owns the instruction line — translated per learner, while the projection
  // carries the author's own. One or the other, never both (precedent: plan 53 §5).
  const shown =
    instruction === undefined || instruction === '' ? projection.instruction : instruction;

  return (
    <HighlightInTextBody
      projection={projection}
      instruction={shown}
      questionIndex={questionIndex}
      completed={completed}
      marks={marks}
      onMark={mark}
      onExtend={extend}
      onClear={() => setMarks([])}
      verdict={verdict}
      attempt={attempt}
      sending={submit.isPending}
      error={error}
      onCheck={() => send()}
      onRetry={retry}
      onReveal={() => send(true)}
      onNext={next}
      accent={PRACTICE_ACCENT}
      audio={audio}
      audioTranscript={transcript}
    />
  );
}
