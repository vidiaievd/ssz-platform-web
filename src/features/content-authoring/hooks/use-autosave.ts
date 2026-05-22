'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions {
  onSave: () => Promise<void>;
  debounceMs?: number;
}

export interface UseAutosaveReturn {
  status: AutosaveStatus;
  savedAt: Date | null;
  /** Schedule a debounced save. Resets any pending timer. */
  schedule: () => void;
  /** Cancel a pending debounced save without saving. */
  cancel: () => void;
  /** Mark status as saved with a fresh timestamp (call after explicit form submit). */
  markSaved: () => void;
}

export function useAutosave({
  onSave,
  debounceMs = 1500,
}: UseAutosaveOptions): UseAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always call the latest onSave without restarting timers on every render
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const run = useCallback(async () => {
    setStatus('saving');
    try {
      await onSaveRef.current();
      setSavedAt(new Date());
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }, []);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('idle');
    timerRef.current = setTimeout(() => void run(), debounceMs);
  }, [debounceMs, run]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const markSaved = useCallback(() => {
    setSavedAt(new Date());
    setStatus('saved');
  }, []);

  return { status, savedAt, schedule, cancel, markSaved };
}
