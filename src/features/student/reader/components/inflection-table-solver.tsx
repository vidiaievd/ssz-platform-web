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
  InflectionTableBody,
  InflectionTableReaderCard,
  PRACTICE_ACCENT,
  readInflectionTableProjection,
  type InflectionTablePhase,
  type InflectionTableValues,
} from '@/features/student/exercises/runner';
import type {
  InflectionTableSubmitDetails,
  InflectionTableSubmittedAnswer,
} from '@/features/student/exercises/types/attempts';
import type { StudentProjection } from '@/lib/shared-kernel/inflection-table';
import { useExerciseAudio } from '@/features/student/exercises/audio';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface InflectionTableSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** The exercise's title, from the lesson item — the card's and the header's name. */
  title?: string;
  /** Fired once, on the first check — the honest signal for progress. */
  onChecked?: (ok: boolean | null) => void;
  /** On the shared solver signature, unread: the table draws its own progress. */
  stacked?: boolean;
}

/**
 * `inflection_table` in the reader: a card, then the whole table against the server
 * (plan 69, Q4-A).
 *
 * **The card first.** It is drawn from the display projection the exercise page has already
 * loaded (the same cached query), so it costs no attempt; the attempt opens on the press. A
 * learner coming back to an attempt the engine resumes does not see it.
 */
export function InflectionTableSolver({
  exerciseId,
  instruction,
  language,
  title,
  onChecked,
}: InflectionTableSolverProps) {
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
      <InflectionTableRun
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

  const projection = readInflectionTableProjection(display.data?.content);
  if (display.isError || projection === null) {
    return <ErrorState onRetry={() => display.refetch()} />;
  }

  return (
    <InflectionTableReaderCard
      projection={projection}
      {...(title === undefined ? {} : { title })}
      onStart={() => setStage('run')}
      accent={PRACTICE_ACCENT}
    />
  );
}

interface InflectionTableRunProps {
  exerciseId: string;
  instruction?: string;
  language: string;
  title?: string;
  onChecked?: (ok: boolean | null) => void;
}

/**
 * The whole table, checked as one.
 *
 * Nothing on this screen knows which form is right. The forms go up and the verdict comes
 * down: whether each cell is right, the near miss and the author's reason for a wrong one on
 * every check, and the correct form only when `revealKey` lets it out (plan 69 §3.5). That
 * dosing is the type — a retry offered by a browser already holding the key is decoration.
 *
 * A check is a `submit` of every filled cell, and a re-check is another `submit` onto the same
 * attempt: the engine reopens a scored practice attempt and counts the checks against the
 * author's budget. Which check this is, which cells are frozen and what each held the first
 * time round are facts about the attempt, and the engine writes its own over anything a client
 * might put in their place — none of them is sent from here.
 *
 * Three things are held here that are not one thing, as for `sort_into_buckets`: **`locked`**
 * (the server's frozen set, which outlives the verdict), **`verdict`** (the last check, `null`
 * between a retry and the next) and **`attempt`** (the check the table is *on*, which a retry
 * moves past the last one before the server has been asked anything).
 *
 * **A closed table is closed even with budget left**: all-right leaves checks unspent and the
 * engine refuses a further one, so `closed` from the verdict decides the buttons, never a
 * count kept here.
 */
function InflectionTableRun({
  exerciseId,
  instruction,
  language,
  title,
  onChecked,
}: InflectionTableRunProps) {
  const t = useTranslations('ExerciseRunner.inflectionTable');

  const start = useStartAttempt(exerciseId);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [projection, setProjection] = useState<StudentProjection | null>(null);
  /** The document as the engine dealt it, kept for the audio layer alone (plan 56). */
  const [document, setDocument] = useState<unknown>(null);
  const [transcript, setTranscript] = useState<{ transcript: string; translation: string } | null>(
    null,
  );
  /** Set when the table arrived with its answer key still on it — see the projection reader. */
  const [unusable, setUnusable] = useState(false);

  const submit = useSubmitAnswer(exerciseId, attemptId);

  const [values, setValues] = useState<InflectionTableValues>({});
  const [phase, setPhase] = useState<InflectionTablePhase>('answering');
  const [verdict, setVerdict] = useState<InflectionTableSubmitDetails | null>(null);
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
          const table = readInflectionTableProjection(data.exerciseContent);
          if (table === null) {
            setUnusable(true);
            return;
          }

          setAttemptId(data.attemptId);
          setProjection(table);
          setDocument(data.exerciseContent);
          setTranscript(null);
          setValues({});
          setPhase('answering');
          setVerdict(null);
          setLocked([]);
          setAttempt(1);
          setError(null);
          openedAt.current = Date.now();
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
   * Hand the table in. Every filled cell goes, frozen ones included: the server keeps a cell
   * it froze, and sending only the new ones would make a check depend on what this component
   * remembers rather than on what the table says.
   */
  function send() {
    if (attemptId === null || submit.isPending) return;
    setError(null);

    const cells: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value.trim() !== '') cells[key] = value;
    }
    const answer: InflectionTableSubmittedAnswer = { cells };
    const openAttemptId = attemptId;

    submit.mutate(
      {
        submittedAnswer: answer,
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
      },
      {
        onSuccess: (data) => {
          const details = data.details as InflectionTableSubmitDetails | undefined;
          if (details === undefined || !Array.isArray(details.items)) {
            setError(t('sendFailed'));
            return;
          }

          setVerdict(details);
          setLocked(details.locked);
          setAttempt(details.attempt);
          setPhase('checked');
          if (data.audioTranscript !== undefined) setTranscript(data.audioTranscript);

          // Once, and on the first check: a corrected table is not evidence the paradigm was
          // known, which is why the engine publishes its score event on the first check alone.
          if (!reported.current) {
            reported.current = true;
            onChecked?.(data.requiresReview ? null : data.correct);
          }
        },
        onError: async (e) => {
          // A refusal the engine will keep making — this table is closed, the budget is spent
          // — reads the same as a lost request, but only one is worth pressing again for.
          if (e instanceof AttemptRequestError && e.status === 422) {
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

  /** Type or place a form. A frozen cell is not the student's to change. */
  function change(key: string, value: string | null) {
    if (locked.includes(key)) return;
    setValues((current) => {
      const next = { ...current };
      if (value === null || value === '') delete next[key];
      else next[key] = value;
      return next;
    });
  }

  /**
   * «Prøv de gale på nytt» — exactly the cells the last check found wrong are emptied
   * (IT-R4). Frozen cells stay; so does a cell filled since the check, which was neither right
   * nor wrong. The check the table is on moves past the one that was just made.
   */
  function retry() {
    if (verdict === null) return;

    const wrong = new Set(
      verdict.items
        .filter((item) => !item.correct && values[item.itemId] === item.value)
        .map((item) => item.itemId),
    );
    setValues((current) => {
      const next: InflectionTableValues = {};
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
    <InflectionTableBody
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
      accent={PRACTICE_ACCENT}
      audio={audio}
      audioTranscript={transcript}
    />
  );
}
