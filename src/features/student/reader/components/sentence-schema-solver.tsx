'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  AttemptRequestError,
  resolveSubmitFailure,
  useCheckRow,
  useStartAttempt,
  useSubmitAnswer,
} from '@/features/student/exercises/api/use-attempt';
import {
  PRACTICE_ACCENT,
  readSentenceSchemaProjection,
  SentenceSchemaBody,
  type SentenceSchemaPhase,
} from '@/features/student/exercises/runner';
import {
  deferPosition,
  nextPosition,
  type SetStep,
} from '@/features/student/exercises/runner/sentence-set-order';
import type { ResumedRow } from '@/features/student/exercises/types/attempts';
import type {
  Placement,
  StudentProjection,
  StudentResult,
} from '@/lib/shared-kernel/sentence-schema';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface SentenceSchemaSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** Fired once, when the set is closed. */
  onChecked?: (ok: boolean | null) => void;
  /** True when the set is one card in a stack of tasks rather than the whole screen. */
  stacked?: boolean;
}

/** One sentence, as this runner is keeping track of it. */
interface RowState {
  placement: Placement;
  attempt: number;
  result: StudentResult | null;
  phase: SentenceSchemaPhase;
}

/**
 * `sentence_schema` played against the server, a sentence at a time.
 *
 * Every mark on the screen came from the engine, because the key is which field each
 * piece belongs in — and the note under the board is resolved there too, since its chain
 * runs over the author's per-chunk notes and the sentence's rule (plan 52 §3.2).
 *
 * Unlike `short_answer`, whose questions are final, a sentence here may be checked as
 * often as the learner likes: `Sjekk`, `Rett opp (N)` keeping what was right, `Sjekk`
 * again. What ends a sentence is solving it or asking to be shown it — and the second of
 * those is recorded on the attempt, not merely in this component, so a reload cannot turn
 * a sentence that was shown into one that was solved.
 *
 * The attempt is still one attempt. Each check is a command onto it (`POST .../rows`),
 * and the last sentence closes it with `submit`, which sends every board in one aggregate
 * and regrades all of them: a verdict that reached the client is a verdict a client could
 * send back (plan 52 §3.3).
 *
 * A reload continues the set. The engine hands back an open attempt that already holds
 * checked sentences rather than reporting the conflict a caller resolves by abandoning
 * it, so the boards go back where they were and the closed sentences stay closed.
 */
export function SentenceSchemaSolver({
  exerciseId,
  instruction,
  language,
  onChecked,
  stacked = false,
}: SentenceSchemaSolverProps) {
  const t = useTranslations('ExerciseRunner');

  const start = useStartAttempt(exerciseId);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [projection, setProjection] = useState<StudentProjection | null>(null);
  /** Set when the set arrived with its answer key still on it — see the projection reader. */
  const [unusable, setUnusable] = useState(false);

  const check = useCheckRow(exerciseId, attemptId);
  const submit = useSubmitAnswer(exerciseId, attemptId);

  const [index, setIndex] = useState(0);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  /**
   * Sentences put aside, oldest first, and the memory of every one ever put aside.
   *
   * Both are of this sitting only: the engine records what was checked, and a sentence
   * nobody answered is not a fact it has an opinion about. A reload therefore offers the
   * set in its plain order again — which is the honest reading of "come back to it later",
   * not a state that has to survive the network.
   */
  const [deferred, setDeferred] = useState<string[]>([]);
  /** State rather than a ref: it decides what the sentence says about itself on screen. */
  const [everDeferred, setEverDeferred] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Wall-clock since the attempt opened; the engine records it per submission. */
  const openedAt = useRef(0);
  /** Guards the close against an effect running twice for the same arrival. */
  const closing = useRef(false);

  /**
   * Put the set back where it was left, from what the engine says is already on it.
   *
   * Sentences the document no longer has are dropped rather than restored: the key can be
   * edited between sittings, and a board belonging to a sentence that is gone is a board
   * with nowhere to go. `revealed` decides the phase, not the marks — a sentence that was
   * shown is closed even though nothing about it was ever right.
   */
  const resume = useCallback((set: StudentProjection, checked: ResumedRow[]) => {
    const state: Record<string, RowState> = {};
    for (const row of set.rows) {
      const was = checked.find((r) => r.rowId === row.id);
      state[row.id] = {
        placement: was?.placement ?? row.start,
        attempt: Math.max(1, was?.attempts ?? 1),
        result: null,
        phase: was?.solved === true || was?.revealed === true ? 'closed' : 'placing',
      };
    }
    setRows(state);
    setError(null);
    setDeferred([]);
    setEverDeferred([]);

    const open = set.rows.findIndex((row) => state[row.id]?.phase !== 'closed');
    setIndex(open === -1 ? Math.max(0, set.rows.length - 1) : open);
    setDone(open === -1 && checked.length > 0);
  }, []);

  const startMutate = start.mutate;
  const begin = useCallback(() => {
    startMutate(
      { language },
      {
        onSuccess: (data) => {
          const set = readSentenceSchemaProjection(data.exerciseContent);
          if (set === null) {
            setUnusable(true);
            return;
          }

          setAttemptId(data.attemptId);
          setProjection(set);
          openedAt.current = Date.now();
          closing.current = false;
          resume(set, data.checkedRows ?? []);
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
   * Close the set: every board at once, none of the verdicts along with them.
   *
   * The validator regrades all of them from the boards and the current key, which is what
   * makes the score independent of anything this browser decided — and the reveals are
   * taken from the attempt rather than from what is sent, which is what makes it
   * independent of anything this browser could claim.
   */
  const closeSet = useCallback(
    (state: Record<string, RowState>, set: StudentProjection) => {
      if (attemptId === null || closing.current) return;
      closing.current = true;
      const openAttemptId = attemptId;
      setDone(true);

      submitMutate(
        {
          submittedAnswer: {
            rows: set.rows.map((row) => ({
              rowId: row.id,
              placement: state[row.id]?.placement ?? {},
              revealed: state[row.id]?.phase === 'closed' && state[row.id]?.result?.solved !== true,
            })),
          },
          timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
        },
        {
          onSuccess: (data) => onChecked?.(data.requiresReview ? null : data.correct),
          onError: async () => {
            // The work may well have landed: the engine accepts a submission before it
            // scores it, so a lost response is not a lost set.
            const resolution = await resolveSubmitFailure(exerciseId, openAttemptId);
            if (resolution === 'delivered') onChecked?.(null);
            else setError(t('sentenceSchema.closeFailed'));
          },
        },
      );
    },
    [attemptId, exerciseId, onChecked, submitMutate, t],
  );

  if (!unusable && (start.isPending || (start.isSuccess && projection === null))) {
    return <LearningSkeleton variant="list" rows={4} />;
  }
  if (unusable || start.isError || projection === null || attemptId === null) {
    return <ErrorState onRetry={retryStart} />;
  }
  if (projection.rows.length === 0) {
    // Nothing deliverable in the set. Not an error — an exercise whose author has not
    // finished a sentence yet — so it says so rather than showing a broken board.
    return (
      <p className="text-[13.5px]" style={{ color: 'var(--ssz-text-muted)' }}>
        {t('sentenceSchema.nothingToSolve')}
      </p>
    );
  }

  const set = projection;
  const row = set.rows[Math.min(index, set.rows.length - 1)]!;
  const state = rows[row.id] ?? {
    placement: row.start,
    attempt: 1,
    result: null,
    phase: 'placing' as const,
  };

  const tally = {
    solved: set.rows.filter((r) => rows[r.id]?.result?.solved === true).length,
    revealed: set.rows.filter(
      (r) => rows[r.id]?.phase === 'closed' && rows[r.id]?.result?.solved !== true,
    ).length,
    // Never closed and never answered: the ones walked away from. Counted from the set
    // rather than from the queue, which is empty by the time the set ends.
    skipped: set.rows.filter((r) => rows[r.id]?.phase !== 'closed' && everDeferred.includes(r.id))
      .length,
  };

  function update(rowId: string, patch: Partial<RowState>) {
    setRows((current) => ({
      ...current,
      [rowId]: { ...(current[rowId] ?? state), ...patch },
    }));
  }

  /** Any placement drops the marks: they were about the board as it was. */
  function place(placement: Placement) {
    update(row.id, {
      placement,
      ...(state.phase === 'checked' ? { phase: 'placing' as const } : {}),
    });
  }

  function send(reveal: boolean) {
    if (check.isPending) return;
    setError(null);

    check.mutate(
      { rowId: row.id, placement: state.placement, reveal },
      {
        onSuccess: (data) => {
          update(row.id, {
            result: data.result,
            attempt: data.result.attempt,
            phase: reveal || data.result.solved ? 'closed' : 'checked',
            // A reveal fills the board in with the answer it just showed.
            ...(data.result.solution !== null ? { placement: data.result.solution } : {}),
          });
        },
        onError: (e) =>
          setError(
            e instanceof AttemptRequestError && e.status === 422
              ? t('sentenceSchema.closedAlready')
              : t('sentenceSchema.checkFailed'),
          ),
      },
    );
  }

  /** `Rett opp`: keep what was right, clear the rest, and count the attempt up. */
  function fix() {
    const marks = state.result;
    if (marks === null) return;

    const kept: Placement = {};
    for (const [fieldId, items] of Object.entries(state.placement)) {
      const right = items.filter((id) => marks.byItem[id] === 'ok');
      if (right.length > 0) kept[fieldId] = right;
    }
    update(row.id, { placement: kept, result: null, phase: 'placing' });
  }

  /** Where the set goes from here — forward, then back to what was put aside, then done. */
  function move(step: SetStep) {
    setDeferred(step.deferred);
    if (step.index === null) {
      closeSet(rows, set);
      return;
    }
    setIndex(step.index);
  }

  const position = {
    ids: set.rows.map((r) => r.id),
    index,
    isClosed: (rowId: string) => rows[rowId]?.phase === 'closed',
    deferred,
  };

  function next() {
    move(nextPosition(position));
  }

  /** Put this one aside. Nothing is sent: an unanswered sentence has nothing to report. */
  function skip() {
    // The memory is read as it was *before* this refusal, and written after. Passing the
    // updated list would have the sentence tell `deferPosition` it had already been round
    // once — so the first skip would be treated as the second and queue nothing.
    move(deferPosition(position, everDeferred));
    if (!everDeferred.includes(row.id)) setEverDeferred([...everDeferred, row.id]);
  }

  function restart() {
    setRows({});
    setDeferred([]);
    setEverDeferred([]);
    setIndex(0);
    setDone(false);
    setError(null);
    closing.current = false;
    begin();
  }

  return (
    <div>
      <SentenceSchemaBody
        row={row}
        settings={set.settings}
        index={index}
        total={set.rows.length}
        instruction={
          instruction !== undefined && instruction !== '' ? instruction : set.instruction
        }
        placement={state.placement}
        onPlacementChange={place}
        phase={done ? 'done' : state.phase}
        attempt={state.attempt}
        result={state.result}
        tally={tally}
        sending={check.isPending}
        error={error}
        onCheck={() => send(false)}
        onRetry={fix}
        onReveal={() => send(true)}
        onNext={next}
        onSkip={set.rows.length > 1 ? skip : undefined}
        lastSentence={nextPosition(position).index === null}
        deferred={everDeferred.includes(row.id)}
        onRestart={stacked ? undefined : restart}
        accent={PRACTICE_ACCENT}
      />
    </div>
  );
}
