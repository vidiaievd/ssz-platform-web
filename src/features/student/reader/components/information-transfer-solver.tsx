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
  InformationTransferBody,
  InformationTransferReaderCard,
  PRACTICE_ACCENT,
  readInformationTransferProjection,
  type InformationTransferPhase,
  type InformationTransferValues,
} from '@/features/student/exercises/runner';
import type {
  InformationTransferSubmitDetails,
  InformationTransferSubmittedAnswer,
} from '@/features/student/exercises/types/attempts';
import { audioOf } from '@/lib/shared-kernel/audio';
import type { StudentProjection } from '@/lib/shared-kernel/information-transfer';
import { useExerciseAudio } from '@/features/student/exercises/audio';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface InformationTransferSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** The exercise's title, from the lesson item — the card's and the header's name. */
  title?: string;
  /** Fired once, on the first check — the honest signal for progress. */
  onChecked?: (ok: boolean | null) => void;
  /** On the shared solver signature, unread: the blank draws its own progress. */
  stacked?: boolean;
}

/**
 * `information_transfer` in the reader: a card, then the whole blank against the server
 * (plan 73 §7.10, §3.6).
 *
 * **The card first.** It is drawn from the display projection the exercise page has already
 * loaded (the same cached query), so it costs no attempt; the attempt opens on the press. A
 * learner coming back to a blank the engine resumes does not see it.
 */
export function InformationTransferSolver({
  exerciseId,
  instruction,
  language,
  title,
  onChecked,
}: InformationTransferSolverProps) {
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
      <InformationTransferRun
        exerciseId={exerciseId}
        language={language}
        {...(title === undefined ? {} : { title })}
        {...(instruction === undefined ? {} : { instruction })}
        {...(onChecked === undefined ? {} : { onChecked })}
      />
    );
  }

  if (stage === 'deciding' || display.isLoading) {
    return <LearningSkeleton variant="list" rows={2} />;
  }

  const projection = readInformationTransferProjection(display.data?.content);
  if (display.isError || projection === null) {
    return <ErrorState onRetry={() => display.refetch()} />;
  }

  const audio = audioOf(display.data?.content);
  return (
    <InformationTransferReaderCard
      projection={projection}
      plays={audio.settings.plays}
      fragments={audio.useSegments}
      {...(title === undefined ? {} : { title })}
      onStart={() => setStage('run')}
      accent={PRACTICE_ACCENT}
    />
  );
}

interface InformationTransferRunProps {
  exerciseId: string;
  instruction?: string;
  language: string;
  title?: string;
  onChecked?: (ok: boolean | null) => void;
}

/**
 * The whole blank, checked as one.
 *
 * Nothing on this screen knows which value is right. The cells go up and the verdict comes
 * down: whether each is counted, the author's reason for one that is not on every check, and
 * the standard form or the key only where `revealKey` lets it out (plan 73 §3.6). That dosing
 * is the type — a retry offered by a browser already holding the key is decoration.
 *
 * A check is a `submit` of every filled cell, and a re-check is another `submit` onto the same
 * attempt: the engine reopens a scored practice attempt and counts the checks against the
 * author's budget. Which check this is, which cells are frozen and what each held the first
 * time round are facts about the attempt, and the engine writes its own over anything a client
 * might put in their place — none of them is sent from here.
 *
 * Three things are held here that are not one thing, as for `inflection_table`: **`locked`**
 * (the server's frozen set, which outlives the verdict), **`verdict`** (the last check, `null`
 * between a retry and the next) and **`attempt`** (the check the blank is *on*, which a retry
 * moves past the last one before the server has been asked anything).
 *
 * **A closed blank is closed even with budget left**: all-right leaves checks unspent and the
 * engine refuses a further one, so `closed` from the verdict decides the buttons, never a
 * count kept here. «Ny runde» is a new attempt, not a reset of this one.
 */
function InformationTransferRun({
  exerciseId,
  instruction,
  language,
  title,
  onChecked,
}: InformationTransferRunProps) {
  const t = useTranslations('ExerciseRunner.informationTransfer');

  const start = useStartAttempt(exerciseId);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [projection, setProjection] = useState<StudentProjection | null>(null);
  /** The document as the engine dealt it, kept for the audio layer alone (plan 56). */
  const [document, setDocument] = useState<unknown>(null);
  const [transcript, setTranscript] = useState<{ transcript: string; translation: string } | null>(
    null,
  );
  /** Set when the blank arrived with its answer key still on it — see the projection reader. */
  const [unusable, setUnusable] = useState(false);
  /** Bumped by every new attempt, so the body — its step and its gate — starts afresh. */
  const [round, setRound] = useState(0);

  const submit = useSubmitAnswer(exerciseId, attemptId);

  const [values, setValues] = useState<InformationTransferValues>({});
  const [phase, setPhase] = useState<InformationTransferPhase>('answering');
  const [verdict, setVerdict] = useState<InformationTransferSubmitDetails | null>(null);
  const [locked, setLocked] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(1);
  const [error, setError] = useState<string | null>(null);

  /** Wall-clock since the attempt opened; the engine records it per submission. */
  const openedAt = useRef(0);
  /** So progress is reported for the first check only — the one the SRS is built on. */
  const reported = useRef(false);

  const startMutate = start.mutate;
  const begin = useCallback(() => {
    startMutate(
      { language },
      {
        onSuccess: (data) => {
          const blank = readInformationTransferProjection(data.exerciseContent);
          if (blank === null) {
            setUnusable(true);
            return;
          }

          // A blank the engine hands back as it stood after a check: the cells as they were
          // written, the verdict that came with them, the budget already spent. Only a verdict
          // of the right shape counts; anything else opens a plain, empty blank.
          const resumed = data.boardCheck;
          const back =
            resumed != null &&
            'passPct' in resumed &&
            Array.isArray(resumed.items) &&
            Array.isArray(resumed.locked)
              ? resumed
              : null;

          setAttemptId(data.attemptId);
          setProjection(blank);
          setDocument(data.exerciseContent);
          setTranscript(null);
          setValues(
            back === null
              ? {}
              : Object.fromEntries(
                  back.items
                    .filter((item) => item.value !== '')
                    .map((item) => [item.itemId, item.value]),
                ),
          );
          setPhase(back === null ? 'answering' : 'checked');
          setVerdict(back);
          setLocked(back === null ? [] : back.locked);
          setAttempt(back === null ? 1 : back.attempt);
          setError(null);
          setRound((n) => n + 1);
          openedAt.current = Date.now();
          // The first check was reported before the reload; it is not evidence a second time.
          if (back !== null) reported.current = true;
        },
      },
    );
  }, [startMutate, language]);

  useEffect(() => {
    begin();
  }, [begin]);

  const retryStart = useCallback(() => {
    setUnusable(false);
    begin();
  }, [begin]);

  const audio = useExerciseAudio(document);

  if (!unusable && (start.isPending || (start.isSuccess && projection === null))) {
    return <LearningSkeleton variant="list" rows={4} />;
  }
  if (unusable || start.isError || projection === null || attemptId === null) {
    return <ErrorState onRetry={retryStart} />;
  }

  // The reader owns the instruction line — it is translated per learner, while the projection
  // carries the author's own, in the language being learned (precedent: plan 53 §5).
  const shown =
    instruction === undefined || instruction === '' ? projection.instruction : instruction;

  /**
   * Hand the blank in. Every filled cell goes, frozen ones included: the server keeps a cell it
   * froze, and sending only the new ones would make a check depend on what this component
   * remembers rather than on what the blank says.
   */
  function send() {
    if (attemptId === null || submit.isPending) return;
    setError(null);

    const cells: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value.trim() !== '') cells[key] = value;
    }
    const answer: InformationTransferSubmittedAnswer = { cells };
    const openAttemptId = attemptId;

    submit.mutate(
      {
        submittedAnswer: answer,
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
      },
      {
        onSuccess: (data) => {
          const details = data.details as InformationTransferSubmitDetails | undefined;
          if (details === undefined || !Array.isArray(details.items)) {
            setError(t('sendFailed'));
            return;
          }

          setVerdict(details);
          setLocked(details.locked);
          setAttempt(details.attempt);
          setPhase('checked');
          // Owed only when the blank closes: before that it would be the key of every cell
          // still open (deviation 16).
          if (data.audioTranscript !== undefined) setTranscript(data.audioTranscript);

          // Once, and on the first check: a corrected blank is not evidence the source was
          // understood, which is why the engine scores the first check alone.
          if (!reported.current) {
            reported.current = true;
            onChecked?.(data.requiresReview ? null : data.correct);
          }
        },
        onError: async (e) => {
          // A refusal the engine will keep making — this blank is closed, the budget is spent
          // — reads the same as a lost request, but only one is worth pressing again for.
          if (e instanceof AttemptRequestError && (e.status === 422 || e.status === 409)) {
            setError(t('closedAlready'));
            return;
          }
          // The check may well have landed: ask, to tell a lost request from a lost response.
          const resolution = await resolveSubmitFailure(exerciseId, openAttemptId);
          setError(resolution === 'delivered' ? t('closedAlready') : t('sendFailed'));
        },
      },
    );
  }

  /** Type a value. A frozen cell is not the student's to change. */
  function change(key: string, value: string) {
    if (locked.includes(key)) return;
    setValues((current) => {
      const next = { ...current };
      if (value === '') delete next[key];
      else next[key] = value;
      return next;
    });
  }

  /**
   * «Rett opp N felt» — exactly the cells the last check did not count are emptied. Frozen
   * cells stay; so does a cell changed since the check, which was neither right nor wrong. The
   * check the blank is on moves past the one that was just made.
   */
  function retry() {
    if (verdict === null) return;

    const wrong = new Set(
      verdict.items
        .filter((item) => !item.correct && values[item.itemId] === item.value)
        .map((item) => item.itemId),
    );
    setValues((current) => {
      const next: InformationTransferValues = {};
      for (const [key, value] of Object.entries(current)) {
        if (!wrong.has(key) || locked.includes(key)) next[key] = value;
      }
      return next;
    });

    setAttempt(verdict.attempt + 1);
    setVerdict(null);
    setPhase('answering');
    setError(null);
  }

  return (
    <InformationTransferBody
      key={round}
      projection={projection}
      {...(title === undefined ? {} : { title })}
      instruction={shown}
      values={values}
      onValueChange={change}
      phase={phase}
      verdict={verdict}
      locked={locked}
      attempt={attempt}
      sending={submit.isPending}
      error={error}
      onCheck={send}
      onRetry={retry}
      onNewRound={begin}
      accent={PRACTICE_ACCENT}
      audio={audio}
      audioTranscript={transcript}
    />
  );
}
