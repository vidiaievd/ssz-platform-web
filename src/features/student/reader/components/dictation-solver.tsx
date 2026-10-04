'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useExerciseForRunner } from '@/features/content/api/use-exercise';
import {
  AttemptRequestError,
  fetchResumable,
  resolveSubmitFailure,
  useStartAttempt,
  useSubmitAnswer,
} from '@/features/student/exercises/api/use-attempt';
import {
  DictationBody,
  DictationReaderCard,
  PRACTICE_ACCENT,
  readDictationProjection,
} from '@/features/student/exercises/runner';
import type {
  DictationSubmitDetails,
  DictationSubmittedAnswer,
} from '@/features/student/exercises/types/attempts';
import {
  DC_CHECK_INTERVAL_MS,
  readSegmentStates,
  type SegmentState,
  type StudentProjection,
} from '@/lib/shared-kernel/dictation';
import { audioOf } from '@/lib/shared-kernel/audio';
import { useExerciseAudio } from '@/features/student/exercises/audio';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface DictationSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** The exercise's title, from the lesson item — the start card's heading. */
  title?: string;
  /** Fired once, when the last sentence closes — the submit the evidence is written on. */
  onChecked?: (ok: boolean | null) => void;
  /** On the shared solver signature, unread: the start card is this runner's fold. */
  stacked?: boolean;
}

/**
 * `dictation` in the reader: a start card, then the sentences against the server
 * (plan 68, Q6-A).
 *
 * **The card first.** In the lesson the exercise is a card — title, sentences, clip length,
 * listens, instruction, «Start diktaten» (BEHAVIOR §7). It is drawn from the display
 * projection the exercise page has already loaded (the same cached query), so it costs no
 * attempt: the attempt opens and the player loads on the press, and a card only glanced at
 * spends no listen. A learner coming back to an attempt with sentences already checked does
 * not see it — the engine resumes that attempt, and the card would only stand in the way.
 */
export function DictationSolver({
  exerciseId,
  instruction,
  language,
  title,
  onChecked,
}: DictationSolverProps) {
  const display = useExerciseForRunner(exerciseId);
  const [stage, setStage] = useState<'deciding' | 'card' | 'run'>('deciding');

  // Once per mount, like the start itself (plan 67, ph. 9).
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void fetchResumable(exerciseId).then((resumable) => setStage(resumable ? 'run' : 'card'));
  }, [exerciseId]);

  if (stage === 'run') {
    return (
      <DictationRun
        exerciseId={exerciseId}
        language={language}
        {...(instruction === undefined ? {} : { instruction })}
        {...(onChecked === undefined ? {} : { onChecked })}
      />
    );
  }

  if (stage === 'deciding' || display.isLoading) {
    return <LearningSkeleton variant="list" rows={2} />;
  }

  const projection = readDictationProjection(display.data?.content);
  if (display.isError || projection === null) {
    return <ErrorState onRetry={() => display.refetch()} />;
  }

  const audio = audioOf(display.data?.content);
  return (
    <DictationReaderCard
      {...(title === undefined ? {} : { title })}
      sentences={projection.segments.length}
      duration={audio.duration}
      plays={audio.settings.plays}
      instruction={
        instruction === undefined || instruction === '' ? projection.instruction : instruction
      }
      onStart={() => setStage('run')}
      accent={PRACTICE_ACCENT}
    />
  );
}

interface DictationRunProps {
  exerciseId: string;
  instruction?: string;
  language: string;
  onChecked?: (ok: boolean | null) => void;
}

/**
 * The sentences, one at a time, in one attempt (plan 68 §3.4 — plan 67's Q1-A with a
 * sentence where that type has a question).
 *
 * Nothing on this screen knows the sentences. The text goes up as typed and the verdict
 * comes down — the corrected line, the counts, whether it passed, the reasons — dosed by how
 * the sentence stands: the reason only after a failed check with hints on, the sentence
 * itself only on a reveal, its transcript slice only once it closed (§3.5, §3.6).
 *
 * Every submit — a check, a retry, the next sentence, a reveal — goes to the same attempt.
 * The engine carries every sentence's state and writes it over anything a client might send;
 * what is kept here is only what the screen needs:
 *
 *   * **`states`** — the server's word on every sentence, from the last response (or the
 *     resumed attempt). The rail, the side list, «which sentence next», the transcript
 *     drawer and the summary are drawn from it.
 *   * **`verdict`** — the last submit of the sentence on screen; `null` while writing.
 *   * **`attempt`** — the check the sentence is *on*, which a retry moves past the last one
 *     before the server has been asked anything.
 *   * **`text`** — the field. A retry keeps it (AC-R8); a reload restores the last checked
 *     text from the state, since text never checked was never on the server.
 *
 * **«Sjekk» rests for two seconds after a check.** The engine refuses a second check of a
 * sentence sooner than that (Q4-A, 429); an ordinary learner never sees the refusal.
 *
 * **The summary's numbers are the server's** — the attempt's score and pass from the closing
 * submit, each sentence's first check as its score (the record, AC-R8) beside its last
 * corrected line (AC-R10).
 */
function DictationRun({ exerciseId, instruction, language, onChecked }: DictationRunProps) {
  const t = useTranslations('ExerciseRunner.dictation');

  const start = useStartAttempt(exerciseId);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [projection, setProjection] = useState<StudentProjection | null>(null);
  /** The document as the engine dealt it, kept for the audio layer alone (plan 56). */
  const [document, setDocument] = useState<unknown>(null);
  /** Set when the sentences arrived with their key still on them — see the projection reader. */
  const [unusable, setUnusable] = useState(false);
  const [startFailed, setStartFailed] = useState(false);

  const submit = useSubmitAnswer(exerciseId, attemptId);

  const [states, setStates] = useState<SegmentState[]>([]);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [text, setText] = useState('');
  const [verdict, setVerdict] = useState<DictationSubmitDetails | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ pct: number; passed: boolean } | null>(null);
  /** The reason each failed check came back with, for the summary to repeat. */
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [cooling, setCooling] = useState(false);

  /** Wall-clock since the attempt opened; the engine records it per submission. */
  const openedAt = useRef(0);
  /** So progress is reported once — on the submit that closes the attempt. */
  const reported = useRef(false);
  const coolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (coolTimer.current !== null) clearTimeout(coolTimer.current);
    },
    [],
  );

  const cool = useCallback(() => {
    if (coolTimer.current !== null) clearTimeout(coolTimer.current);
    setCooling(true);
    coolTimer.current = setTimeout(() => setCooling(false), DC_CHECK_INTERVAL_MS);
  }, []);

  const startAsync = start.mutateAsync;
  const begin = useCallback(() => {
    // A promise, not `mutate(vars, { onSuccess })` — see the highlight solver: per-call
    // callbacks are let go of when strict mode re-mounts, and the start would go unread.
    setStartFailed(false);
    startAsync({ language })
      .then((data) => {
        const dealt = readDictationProjection(data.exerciseContent);
        if (dealt === null) {
          setUnusable(true);
          return;
        }

        const resumed = readSegmentStates(data.segmentStates);
        const open = dealt.segments.findIndex(
          (s) => resumed.find((st) => st.segmentId === s.id)?.closed !== true,
        );
        const at = open === -1 ? 0 : open;
        const here = resumed.find((st) => st.segmentId === dealt.segments[at]?.id);

        setAttemptId(data.attemptId);
        setProjection(dealt);
        setDocument(data.exerciseContent);
        setStates(resumed);
        setSegmentIndex(at);
        // The last checked text comes back into the field (plan 68 §8, 3).
        setText(here?.lastText ?? '');
        setVerdict(null);
        setAttempt((here?.checks ?? 0) + 1);
        setError(null);
        setDone(false);
        openedAt.current = Date.now();
      })
      .catch(() => setStartFailed(true));
  }, [startAsync, language]);

  // Once per mount: a dev double-run would otherwise send two starts a millisecond apart
  // and leave an orphaned `in_progress` row (plan 67, ph. 9).
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

  const segment = projection.segments[segmentIndex];
  const stateOf = (id: string | undefined) => states.find((s) => s.segmentId === id);

  /** Hand the sentence in, or ask to be shown it. */
  function send(reveal = false) {
    if (attemptId === null || segment === undefined || submit.isPending) return;
    setError(null);

    const answer: DictationSubmittedAnswer = reveal
      ? { segmentId: segment.id, reveal: true }
      : { segmentId: segment.id, text };
    const openAttemptId = attemptId;

    submit.mutate(
      {
        submittedAnswer: answer,
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
      },
      {
        onSuccess: (data) => {
          const details = data.details as DictationSubmitDetails | undefined;
          if (
            details === undefined ||
            !Array.isArray(details.ops) ||
            !Array.isArray(details.segments)
          ) {
            setError(t('sendFailed'));
            return;
          }

          setVerdict(details);
          setStates(readSegmentStates(details.segments));
          setAttempt(details.attempt);
          setResult({ pct: details.attemptPct, passed: details.attemptPassed });
          if (!reveal) cool();
          const why = details.why;
          if (why !== undefined && why.trim() !== '') {
            setReasons((current) => ({ ...current, [details.segmentId]: why }));
          }

          // Once, and when the attempt closes: that submit is the one the engine scores and
          // publishes evidence on, with every sentence's first check in it.
          if (details.complete && !reported.current) {
            reported.current = true;
            onChecked?.(data.requiresReview ? null : details.attemptPassed);
          }
        },
        onError: async (e) => {
          // Too soon after the last check: the server kept nothing, the text is still here.
          if (e instanceof AttemptRequestError && e.status === 429) {
            setError(t('tooFast'));
            cool();
            return;
          }
          // A refusal the engine will keep making — this sentence is closed.
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

  /** «Prøv på nytt» — the text stays (AC-R8), and the check moves on. */
  function retry() {
    if (verdict === null) return;
    setAttempt(verdict.attempt + 1);
    setVerdict(null);
    setError(null);
  }

  /** «Neste setning» — the next sentence still open, at the check after its last. */
  function next() {
    if (projection === null) return;
    const ahead = projection.segments.findIndex(
      (s, i) => i > segmentIndex && stateOf(s.id)?.closed !== true,
    );
    if (ahead === -1) {
      setDone(true);
      return;
    }
    const here = stateOf(projection.segments[ahead]?.id);
    // The server's rest is per sentence: a new one may be checked at once.
    if (coolTimer.current !== null) clearTimeout(coolTimer.current);
    setCooling(false);
    setSegmentIndex(ahead);
    setText(here?.lastText ?? '');
    setVerdict(null);
    setAttempt((here?.checks ?? 0) + 1);
    setError(null);
  }

  // The reader owns the instruction line — translated per learner, while the projection
  // carries the author's own. One or the other, never both (precedent: plan 53 §5).
  const shown =
    instruction === undefined || instruction === '' ? projection.instruction : instruction;

  return (
    <DictationBody
      projection={projection}
      instruction={shown}
      segmentIndex={segmentIndex}
      states={states}
      text={text}
      onText={(value) => {
        setText(value);
        setError(null);
      }}
      verdict={verdict}
      attempt={attempt}
      done={done}
      result={result}
      reasons={reasons}
      cooling={cooling}
      sending={submit.isPending}
      error={error}
      onCheck={() => send()}
      onRetry={retry}
      onReveal={() => send(true)}
      onNext={next}
      onFinish={() => setDone(true)}
      accent={PRACTICE_ACCENT}
      audio={audio}
    />
  );
}
