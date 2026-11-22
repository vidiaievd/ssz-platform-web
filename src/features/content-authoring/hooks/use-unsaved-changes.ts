'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ErrorLike } from '@/lib/errors/use-error-message';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/**
 * Thrown by an `onSave` the server refused. The save button reads the refusal back and shows its
 * reason (a read-only school, a conflict…) in its one failure toast, so `onSave` must not toast it too.
 */
export class SaveRefusedError extends Error {
  constructor(readonly error: ErrorLike) {
    super(error.code);
    this.name = 'SaveRefusedError';
  }
}

interface UseUnsavedChangesOptions {
  /**
   * The save itself. Only needed by editors whose save button is driven by this
   * hook; panes that submit through their own form handler just report the
   * outcome with `markSaved`.
   */
  onSave?: () => Promise<void>;
  /** Ask the browser to confirm before leaving with unsaved edits. */
  warnOnUnload?: boolean;
}

export interface UseUnsavedChangesReturn {
  status: SaveStatus;
  savedAt: Date | null;
  isDirty: boolean;
  /** Record that the local form state diverged from what the server holds. */
  markDirty: () => void;
  /** Run `onSave` and move the status along. Resolves to whether it succeeded. */
  save: () => Promise<boolean>;
  /** What the last failed `save` threw (a `SaveRefusedError` carries the server's refusal). */
  lastError: () => unknown;
  /** Mark clean after an explicit submit the caller performed itself. */
  markSaved: () => void;
  /** Drop the dirty flag without saving (e.g. the form was reset). */
  reset: () => void;
}

/**
 * Tracks whether an editor holds edits the server has not seen.
 *
 * Deliberately does **not** save on a timer. Content edits are live the moment
 * they reach content-service — `PATCH /exercises/:id` and friends rewrite the
 * row every published version points at — so a debounce would push half-typed
 * sentences to students who are reading the lesson right now. Reaching the
 * server is the author's decision, taken by pressing save.
 */
export function useUnsavedChanges({
  onSave,
  warnOnUnload = true,
}: UseUnsavedChangesOptions = {}): UseUnsavedChangesReturn {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Always call the latest onSave without re-registering anything.
  const onSaveRef = useRef(onSave);
  const lastErrorRef = useRef<unknown>(null);
  useEffect(() => {
    onSaveRef.current = onSave;
  });

  const isDirty = status === 'dirty' || status === 'error';

  useEffect(() => {
    if (!warnOnUnload || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Browsers ignore custom text but still need a truthy returnValue.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [warnOnUnload, isDirty]);

  const markDirty = useCallback(() => setStatus('dirty'), []);

  const markSaved = useCallback(() => {
    setSavedAt(new Date());
    setStatus('saved');
  }, []);

  const reset = useCallback(() => setStatus('idle'), []);

  const save = useCallback(async () => {
    if (!onSaveRef.current) return false;
    setStatus('saving');
    lastErrorRef.current = null;
    try {
      await onSaveRef.current();
      setSavedAt(new Date());
      setStatus('saved');
      return true;
    } catch (error) {
      lastErrorRef.current = error;
      setStatus('error');
      return false;
    }
  }, []);

  const lastError = useCallback(() => lastErrorRef.current, []);

  return { status, savedAt, isDirty, markDirty, save, lastError, markSaved, reset };
}
