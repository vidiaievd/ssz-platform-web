'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  toContent,
  toExpectedAnswers,
  type WordBankGapFill,
} from '@/lib/shared-kernel/wordbank-gapfill';

import { saveGapFillAction, type SaveGapFillOutcome } from '../../actions/gap-fill';

/** BEHAVIOR §1.5: edits coalesce, and the teacher never presses a save button. */
const DEBOUNCE_MS = 800;
/** SPEC_api_contract: 1s, 3s, 9s, capped — enough to ride out a blip, not to hammer. */
const BACKOFF_MS = [1_000, 3_000, 9_000, 27_000, 30_000];

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'conflict';

export interface GapFillAutosave {
  status: SaveStatus;
  /** When the last successful save landed, for the "Saved" hint. */
  savedAt: Date | null;
  /** Save now rather than waiting out the backoff — the retry a failure offers. */
  retry: () => void;
}

interface Options {
  exerciseId: string;
  containerId: string;
  exercise: WordBankGapFill;
  instructions: string;
  hint: string;
  /** Whether anything differs from what was loaded. Nothing is written before it does. */
  dirty: boolean;
  onSaved: (updatedAt: string) => void;
}

/**
 * Autosave for the gap-fill builder.
 *
 * The rules that matter are about what happens when a save does *not* work. A failed
 * save keeps the optimistic state and retries with backoff; a conflict stops retrying
 * altogether and hands the decision to the teacher, because the one thing that must
 * never happen is their text disappearing into a write that lost a race.
 */
export function useGapFillAutosave({
  exerciseId,
  containerId,
  exercise,
  instructions,
  hint,
  dirty,
  onSaved,
}: Options): GapFillAutosave {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  /** What to save, read at flush time so a burst of edits saves once, at its latest. */
  const pending = useRef({ exercise, instructions, hint });
  const attempt = useRef(0);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const onSavedRef = useRef(onSaved);

  const schedule = useCallback((delay: number) => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flushRef.current();
    }, delay);
  }, []);

  const flush = useCallback(async () => {
    if (inFlight.current) return;
    const { exercise: document, instructions: text, hint: hintText } = pending.current;

    inFlight.current = true;
    setStatus('saving');

    const result = await saveGapFillAction(exerciseId, containerId, {
      content: toContent(document),
      expectedAnswers: toExpectedAnswers(document),
      expectedUpdatedAt: document.updatedAt,
      instructions: text,
      hint: hintText,
    });
    inFlight.current = false;

    if (!result.ok) {
      // Keep the edit on screen and try again later: an editor that discarded what was
      // typed because the network blinked would be worse than no autosave at all.
      attempt.current += 1;
      setStatus('failed');
      schedule(BACKOFF_MS[Math.min(attempt.current - 1, BACKOFF_MS.length - 1)] ?? 30_000);
      return;
    }

    const outcome: SaveGapFillOutcome = result.value;
    if (outcome.status === 'conflict') {
      // No backoff here. Retrying would either fail forever or, worse, succeed against a
      // document the teacher has never seen. This one is theirs to resolve.
      attempt.current = 0;
      setStatus('conflict');
      return;
    }

    attempt.current = 0;
    setStatus('saved');
    setSavedAt(new Date());
    onSavedRef.current(outcome.updatedAt);
  }, [exerciseId, containerId, schedule]);

  // Kept current after every render, and declared before the effect that schedules a
  // save so that a flush always reads the newest document rather than the one from the
  // render that queued it.
  useEffect(() => {
    pending.current = { exercise, instructions, hint };
    onSavedRef.current = onSaved;
    flushRef.current = flush;
  });

  useEffect(() => {
    if (!dirty || status === 'conflict') return;
    schedule(DEBOUNCE_MS);
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
    // The document is the trigger: every edit reschedules the one pending save. `status`
    // is deliberately not a dependency — it changes on every save and would reschedule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise, instructions, hint, dirty, schedule]);

  const retry = useCallback(() => {
    attempt.current = 0;
    void flushRef.current();
  }, []);

  return { status, savedAt, retry };
}
