'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { AppErrorCode } from '@/lib/errors';
import { toContent, toExpectedAnswers, type WritingTask } from '@/lib/shared-kernel/writing-task';

import { saveWritingTaskAction, type SaveWritingTaskOutcome } from '../../actions/writing-task';

/** BEHAVIOR §1.5: edits coalesce, and the teacher never presses a save button. */
const DEBOUNCE_MS = 800;
/** SPEC_api_contract: 1s, 3s, 9s, capped — enough to ride out a blip, not to hammer. */
const BACKOFF_MS = [1_000, 3_000, 9_000, 27_000, 30_000];

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'rejected' | 'conflict';

/**
 * Refusals no amount of retrying will turn into a save.
 *
 * A blip on the wire and a document the server will not accept look identical to a
 * caller — both arrive as a failed action — but they need opposite treatment. Backoff is
 * right for the blip and wrong for the refusal: the same request re-sent every thirty
 * seconds cannot start succeeding, and while it loops the author is told "your edits are
 * still here" over and over, which reads as a network problem that will pass. It will
 * not. So a refusal stops the loop and says what the server said, with `Try again` left
 * in place for the author who has fixed the cause from another window.
 */
const PERMANENT: ReadonlySet<AppErrorCode> = new Set<AppErrorCode>([
  'validation',
  'forbidden',
  'not_found',
  'gone',
  'unauthenticated',
]);

export interface WritingTaskAutosave {
  status: SaveStatus;
  /** When the last successful save landed, for the "Saved" hint. */
  savedAt: Date | null;
  /** What the server said when it refused the document. Only set while `rejected`. */
  rejection: string | null;
  /**
   * How many transient failures have followed each other without a save in between.
   *
   * The notice a failure deserves depends on this number and on nothing else: the first
   * one is a blink that the backoff will very likely ride out, and telling the author
   * about it teaches them to ignore the next. The second in a row is a real problem.
   */
  failures: number;
  /** Save now rather than waiting out the backoff — the retry a failure offers. */
  retry: () => void;
  /**
   * Write on top of the version that won the race, keeping what is on screen. Only
   * meaningful after a conflict, which is the one state autosave cannot leave on its own.
   */
  overwrite: () => void;
  /** Whether `overwrite` has a version to write over — a conflict is being reported. */
  canOverwrite: boolean;
}

interface Options {
  exerciseId: string;
  containerId: string;
  exercise: WritingTask;
  /** The token the row now carries, with the document that was written to earn it. */
  onSaved: (updatedAt: string, saved: SavedDocument) => void;
}

export interface SavedDocument {
  exercise: WritingTask;
}

/**
 * The document as it was last written (or loaded), ignoring `updatedAt`.
 *
 * The token is not part of what the teacher wrote: it changes on every save, and a
 * comparison that counted it would report the document dirty the instant it was saved —
 * which is a save loop, not an autosave. Every edit in `edits.ts` replaces the branch it
 * touches, so reference equality per key is an accurate answer to "did anything change".
 */
function sameDocument(a: WritingTask, b: WritingTask): boolean {
  if (a === b) return true;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof WritingTask>;
  for (const key of keys) {
    if (key === 'updatedAt') continue;
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Autosave for the writing-task builder.
 *
 * The rules that matter are about what happens when a save does *not* work. A failed
 * save keeps the optimistic state and retries with backoff; a conflict stops retrying
 * and hands the decision to the teacher, because the one thing that must never happen is
 * their text disappearing into a write that lost a race. What the teacher is handed is a
 * choice, not a dead end: `overwrite` writes on top of the version that won.
 *
 * Nothing is written until the document differs from what was loaded. The baseline lives
 * here rather than in the caller because a caller that rebuilds the loaded document on
 * every render — the obvious way to write that prop — would otherwise have the builder
 * saving a document nobody edited, with whatever token that render happened to carry.
 */
export function useWritingTaskAutosave({
  exerciseId,
  containerId,
  exercise,
  onSaved,
}: Options): WritingTaskAutosave {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  /** The `updatedAt` the row actually carries, learnt from a refused write. */
  const [conflictToken, setConflictToken] = useState<string | null>(null);
  /** The message behind a `rejected`, so the author is told what to fix. */
  const [rejection, setRejection] = useState<string | null>(null);
  /** Transient failures since the last save — what decides whether one is worth saying. */
  const [failures, setFailures] = useState(0);

  /** What was last written or loaded. Anything else on screen is unsaved work. */
  const [baseline, setBaseline] = useState<SavedDocument>({ exercise });

  /** What to save, read at flush time so a burst of edits saves once, at its latest. */
  const pending = useRef({ exercise });
  const attempt = useRef(0);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const onSavedRef = useRef(onSaved);

  const dirty = !sameDocument(exercise, baseline.exercise);

  const schedule = useCallback((delay: number) => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flushRef.current();
    }, delay);
  }, []);

  const flush = useCallback(
    async (force?: { expectedUpdatedAt: string }) => {
      // A save is already on the wire. Come back for whatever was typed since rather than
      // dropping it: this flush is the only thing scheduled, and returning would leave the
      // newest edits unsaved until the teacher happened to type again.
      if (inFlight.current) {
        schedule(DEBOUNCE_MS);
        return;
      }
      const { exercise: document } = pending.current;

      inFlight.current = true;
      setStatus('saving');

      const result = await saveWritingTaskAction(exerciseId, containerId, {
        content: toContent(document),
        expectedAnswers: toExpectedAnswers(document),
        expectedUpdatedAt: force?.expectedUpdatedAt ?? document.updatedAt,
        // The one line the author wrote, written to the instruction row as well as into
        // the document. The platform requires an instruction row before an exercise may
        // be published, and the reader prefers it (it is the translated one) — but asking
        // the author for the same sentence twice would be a field with no question.
        instructions: document.instruction,
      });
      inFlight.current = false;

      if (!result.ok) {
        if (PERMANENT.has(result.error.code)) {
          // Nothing is scheduled. The edit stays on screen — that part never changes —
          // but the author is told this document was refused rather than watching a
          // retry loop describe it as a hiccup.
          attempt.current = 0;
          setRejection(result.error.message);
          setStatus('rejected');
          return;
        }
        // Keep the edit on screen and try again later: an editor that discarded what was
        // typed because the network blinked would be worse than no autosave at all.
        attempt.current += 1;
        setFailures(attempt.current);
        setStatus('failed');
        schedule(BACKOFF_MS[Math.min(attempt.current - 1, BACKOFF_MS.length - 1)] ?? 30_000);
        return;
      }

      const outcome: SaveWritingTaskOutcome = result.value;
      if (outcome.status === 'conflict') {
        // No backoff here. Retrying the same token would fail forever, and retrying it
        // silently against the newer row would overwrite a document the teacher has never
        // seen. This one is theirs to resolve — `overwrite` is how they resolve it.
        attempt.current = 0;
        setRejection(null);
        setConflictToken(outcome.currentUpdatedAt);
        setStatus('conflict');
        return;
      }

      attempt.current = 0;
      setFailures(0);
      // Saved: this is now the version everything is compared against, so an untouched
      // document is not written a second time.
      const saved: SavedDocument = { exercise: document };
      setBaseline(saved);
      setConflictToken(null);
      setRejection(null);
      setStatus('saved');
      setSavedAt(new Date());
      onSavedRef.current(outcome.updatedAt, saved);
    },
    [exerciseId, containerId, schedule],
  );

  // Kept current after every render, and declared before the effect that schedules a
  // save so that a flush always reads the newest document rather than the one from the
  // render that queued it.
  useEffect(() => {
    pending.current = { exercise };
    onSavedRef.current = onSaved;
    flushRef.current = () => flush();
  });

  useEffect(() => {
    // A rejected document reschedules on the next edit and not before: the edit is the
    // only thing that can change the server's answer.
    if (!dirty || status === 'conflict') return;
    schedule(DEBOUNCE_MS);
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
    // The document is the trigger: every edit reschedules the one pending save. `status`
    // is deliberately not a dependency — it changes on every save and would reschedule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise, dirty, schedule]);

  const retry = useCallback(() => {
    attempt.current = 0;
    void flushRef.current();
  }, []);

  const overwrite = useCallback(() => {
    if (conflictToken === null) return;
    attempt.current = 0;
    void flush({ expectedUpdatedAt: conflictToken });
  }, [conflictToken, flush]);

  return {
    status,
    savedAt,
    rejection,
    failures,
    retry,
    overwrite,
    canOverwrite: conflictToken !== null,
  };
}
