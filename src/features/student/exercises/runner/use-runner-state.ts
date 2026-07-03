'use client';

import { useState } from 'react';

import type { RunnerPhase } from './types';

interface UseRunnerStateOptions {
  itemCount: number;
  onComplete?: () => void;
}

interface UseRunnerState {
  idx: number;
  phase: RunnerPhase;
  ok: boolean | null;
  canSubmit: boolean;
  isLast: boolean;
  setCanSubmit: (value: boolean) => void;
  /** Call with the client-graded result to transition phase → feedback. */
  submit: (correct: boolean) => void;
  /** Advance to the next item; calls onComplete when the last item is done. */
  advance: () => void;
  /** Reset all per-item state (call when the item set changes). */
  reset: () => void;
}

export function useRunnerState({
  itemCount,
  onComplete,
}: UseRunnerStateOptions): UseRunnerState {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<RunnerPhase>('answering');
  const [ok, setOk] = useState<boolean | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);

  const isLast = idx === itemCount - 1;

  function submit(correct: boolean) {
    setOk(correct);
    setPhase('feedback');
  }

  function advance() {
    if (isLast) {
      onComplete?.();
    } else {
      setIdx((i) => i + 1);
    }
    setPhase('answering');
    setOk(null);
    setCanSubmit(false);
  }

  function reset() {
    setIdx(0);
    setPhase('answering');
    setOk(null);
    setCanSubmit(false);
  }

  return { idx, phase, ok, canSubmit, isLast, setCanSubmit, submit, advance, reset };
}
