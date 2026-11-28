'use client';

import { useEffect, useState } from 'react';

import type {
  AttemptStatusResponse,
  LastAttemptResponse,
  ProvisionalVerdict,
} from '@/features/student/exercises/types/attempts';

/** As often as the screens waiting on a self-study model verdict ask (plan 79, 2.3c2). */
export const PROVISIONAL_POLL_MS = 2_000;
/** A reading is listened to prompt by prompt, so this waits a little longer than 90 s. */
export const PROVISIONAL_GIVE_UP_MS = 120_000;

/**
 * Where a school's work a model reads first stands for the learner (plan 80; OQ-110):
 *
 *   reading  the model has not answered yet — the screen asks every couple of seconds;
 *   slow     it gave up asking; the verdict will still arrive, in «My work»;
 *   ready    the model's provisional verdict is in, waiting for the teacher's;
 *   settled  the work left the queue meanwhile (a teacher answered, or the model's verdict
 *            counted at once in `ai_with_sampling`) — the verdict is for «My work» to show.
 */
export type ProvisionalWait =
  | { stage: 'reading' }
  | { stage: 'slow' }
  | { stage: 'ready'; verdict: ProvisionalVerdict }
  | { stage: 'settled' };

async function readJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Waits for the model's provisional verdict on `attemptId`, starting from what the screen
 * already knows (`initial`, read with the attempt). A failed request reads as «not yet».
 */
export function useProvisionalVerdict(
  exerciseId: string,
  attemptId: string,
  initial: ProvisionalVerdict | null,
): ProvisionalWait {
  const [state, setState] = useState<{ for: string; wait: ProvisionalWait }>(() => ({
    for: attemptId,
    wait: initial === null ? { stage: 'reading' } : { stage: 'ready', verdict: initial },
  }));
  // A new hand-in starts its own wait.
  const current: ProvisionalWait =
    state.for === attemptId
      ? state.wait
      : initial === null
        ? { stage: 'reading' }
        : { stage: 'ready', verdict: initial };
  const waiting = current.stage === 'reading';

  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const settle = (wait: ProvisionalWait) => {
      if (!cancelled) setState({ for: attemptId, wait });
    };

    const tick = async () => {
      const status = await readJson<AttemptStatusResponse>(
        `/api/exercises/${exerciseId}/attempts/${attemptId}`,
      );
      if (cancelled) return;
      if (status !== null && status.status !== 'ROUTED_FOR_REVIEW') {
        settle({ stage: 'settled' });
        return;
      }
      if (status?.provisional === true) {
        const last = await readJson<LastAttemptResponse>(`/api/exercises/${exerciseId}/attempts`);
        if (cancelled) return;
        const verdict =
          last?.attempt?.id === attemptId ? (last.attempt.provisionalVerdict ?? null) : null;
        if (verdict !== null) {
          settle({ stage: 'ready', verdict });
          return;
        }
      }
      if (Date.now() - startedAt >= PROVISIONAL_GIVE_UP_MS) {
        settle({ stage: 'slow' });
        return;
      }
      timer = setTimeout(() => void tick(), PROVISIONAL_POLL_MS);
    };
    timer = setTimeout(() => void tick(), PROVISIONAL_POLL_MS);

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [exerciseId, attemptId, waiting]);

  return current;
}

/** The hand-in a model reads before the teacher, and its verdict if it is already in. */
export interface AiFirstTarget {
  attemptId: string;
  initial: ProvisionalVerdict | null;
}

/** From the submit answer: work sent to a teacher of a school that has a model read it first. */
export function aiFirstFromSubmit(data: {
  attemptId: string;
  requiresReview: boolean;
  reviewer?: 'teacher' | 'ai' | 'none';
  aiFirst?: boolean;
}): AiFirstTarget | null {
  return data.requiresReview && data.reviewer === 'teacher' && data.aiFirst === true
    ? { attemptId: data.attemptId, initial: null }
    : null;
}

/** From an attempt read back: still waiting for its teacher, read by a model first. */
export function aiFirstFromAttempt(attempt: {
  id: string;
  status: string;
  aiFirst?: boolean;
  provisionalVerdict?: ProvisionalVerdict | null;
}): AiFirstTarget | null {
  return attempt.status === 'ROUTED_FOR_REVIEW' && attempt.aiFirst === true
    ? { attemptId: attempt.id, initial: attempt.provisionalVerdict ?? null }
    : null;
}
