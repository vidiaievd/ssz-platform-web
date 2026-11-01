'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { parsePrecheckResult } from './parse';
import type { PrecheckResult } from './types';

export interface PrecheckRun {
  /** A request is in flight. */
  busy: boolean;
  /** The last check that came back; null before the first, and while a new one runs. */
  result: PrecheckResult | null;
  /** Why the last attempt to check did not come back, in the learner's words. */
  error: string | null;
  /** No more asking: the school or the plan said no, or the work is already in. */
  closed: boolean;
  /** Check this draft. Resolves to the result, or null when it did not come back. */
  run: (draftAnswer: unknown) => Promise<PrecheckResult | null>;
}

/**
 * One solver's «Check» before hand-in: asks the engine about the attempt that is open and
 * keeps the last answer for the panel (platform plan 84, web step 8). A rehearsal leaves the
 * attempt in progress, so the same attempt can be checked again and then handed in.
 *
 * A refusal that will not change on its own — 403 (the school or the plan), 409 (already
 * handed in) — closes the control; a network or server trouble leaves it, with a line to try
 * again. A second press while one is in flight would spend a second check, hence the ref.
 */
export function usePrecheckRun(exerciseId: string, attemptId: string | null): PrecheckRun {
  const t = useTranslations('ExerciseRunner.precheck');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PrecheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(
    async (draftAnswer: unknown): Promise<PrecheckResult | null> => {
      if (attemptId === null || inFlight.current) return null;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      setResult(null);
      try {
        const res = await fetch(`/api/exercises/${exerciseId}/attempts/${attemptId}/check`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ draftAnswer }),
        });
        if (res.status === 403 || res.status === 409) {
          setClosed(true);
          return null;
        }
        const parsed = res.ok ? parsePrecheckResult(await res.json().catch(() => null)) : null;
        if (parsed === null) {
          setError(t('failed'));
          return null;
        }
        setResult(parsed);
        return parsed;
      } catch {
        setError(t('failed'));
        return null;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [exerciseId, attemptId, t],
  );

  return { busy, result, error, closed, run };
}
