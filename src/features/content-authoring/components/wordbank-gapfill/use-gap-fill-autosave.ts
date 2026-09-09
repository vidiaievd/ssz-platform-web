'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { applyAudioDraft, type AudioDraft } from '@/lib/shared-kernel/audio';
import {
  TEMPLATE_CODE,
  toContent,
  toExpectedAnswers,
  type WordBankGapFill,
} from '@/lib/shared-kernel/wordbank-gapfill';

import {
  saveGapFillAction,
  type SaveGapFillInput,
  type SaveGapFillOutcome,
} from '../../actions/gap-fill';

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
  exercise: WordBankGapFill;
  instructions: string;
  hint: string;
  /**
   * The listening layer, carried beside the document rather than inside it (plan 56).
   *
   * A sibling of `instructions` and `hint`, which is the shape this builder already has:
   * the kernel type is shared with the services and knows nothing about a block that
   * belongs to no template, and `toContent` would drop it either way.
   */
  audio: AudioDraft;
  /** The token the row now carries, with the document that was written to earn it. */
  onSaved: (updatedAt: string, saved: SavedDocument) => void;
}

export interface SavedDocument {
  exercise: WordBankGapFill;
  instructions: string;
  hint: string;
  audio: AudioDraft;
}

/**
 * The document as it was last written (or loaded), ignoring `updatedAt`.
 *
 * The token is not part of what the teacher wrote: it changes on every save, and a
 * comparison that counted it would report the document dirty the instant it was saved —
 * which is a save loop, not an autosave. Every edit in `edits.ts` replaces the branch it
 * touches, so reference equality per key is an accurate answer to "did anything change".
 */
function sameDocument(a: WordBankGapFill, b: WordBankGapFill): boolean {
  if (a === b) return true;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof WordBankGapFill>;
  for (const key of keys) {
    if (key === 'updatedAt') continue;
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Autosave for the gap-fill builder.
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
export function useGapFillAutosave({
  exerciseId,
  containerId,
  exercise,
  instructions,
  hint,
  audio,
  onSaved,
}: Options): GapFillAutosave {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  /** The `updatedAt` the row actually carries, learnt from a refused write. */
  const [conflictToken, setConflictToken] = useState<string | null>(null);

  /** What was last written or loaded. Anything else on screen is unsaved work. */
  const [baseline, setBaseline] = useState<SavedDocument>({
    exercise,
    instructions,
    hint,
    audio,
  });

  /** What to save, read at flush time so a burst of edits saves once, at its latest. */
  const pending = useRef({ exercise, instructions, hint, audio });
  const attempt = useRef(0);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const onSavedRef = useRef(onSaved);

  const dirty =
    !sameDocument(exercise, baseline.exercise) ||
    instructions !== baseline.instructions ||
    hint !== baseline.hint ||
    // Replaced whole on every edit, exactly like the branches of the document above.
    audio !== baseline.audio;

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
      const {
        exercise: document,
        instructions: text,
        hint: hintText,
        audio: draft,
      } = pending.current;

      inFlight.current = true;
      setStatus('saving');

      const result = await saveGapFillAction(exerciseId, containerId, {
        // The template's own persistence, then the layer that belongs to none of them:
        // `toContent` builds an explicit object and would drop the audio block.
        content: applyAudioDraft(
          toContent(document) as unknown as Record<string, unknown>,
          draft,
          TEMPLATE_CODE,
        ) as SaveGapFillInput['content'],
        expectedAnswers: toExpectedAnswers(document),
        expectedUpdatedAt: force?.expectedUpdatedAt ?? document.updatedAt,
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
        // No backoff here. Retrying the same token would fail forever, and retrying it
        // silently against the newer row would overwrite a document the teacher has never
        // seen. This one is theirs to resolve — `overwrite` is how they resolve it.
        attempt.current = 0;
        setConflictToken(outcome.currentUpdatedAt);
        setStatus('conflict');
        return;
      }

      attempt.current = 0;
      // Saved: this is now the version everything is compared against, so an untouched
      // document is not written a second time.
      const saved: SavedDocument = {
        exercise: document,
        instructions: text,
        hint: hintText,
        audio: draft,
      };
      setBaseline(saved);
      setConflictToken(null);
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
    pending.current = { exercise, instructions, hint, audio };
    onSavedRef.current = onSaved;
    flushRef.current = () => flush();
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
  }, [exercise, instructions, hint, audio, dirty, schedule]);

  const retry = useCallback(() => {
    attempt.current = 0;
    void flushRef.current();
  }, []);

  const overwrite = useCallback(() => {
    if (conflictToken === null) return;
    attempt.current = 0;
    void flush({ expectedUpdatedAt: conflictToken });
  }, [conflictToken, flush]);

  return { status, savedAt, retry, overwrite, canOverwrite: conflictToken !== null };
}
