'use client';

import { useMutation } from '@tanstack/react-query';

import type {
  AttemptRecord,
  AttemptStatus,
  AttemptStatusResponse,
  LastAttemptResponse,
  RevealAnswersResponse,
  SelfCheckRequest,
  SelfCheckResponse,
  StartAttemptRequest,
  StartAttemptResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from '../types/attempts';

/**
 * The exercise-engine attempt flow: start, check, and — only if asked — reveal.
 *
 * Mutations rather than queries throughout, including `start`: starting an attempt
 * writes a row, publishes an event and can conflict with one already running. Caching
 * it as a query would silently resume someone else's idea of where they were.
 */

/**
 * A failed attempt call, with the status kept.
 *
 * Which failure it was matters to the runner in at least one place: a self-check
 * refused for want of budget (422) is a button to put away, while anything else is a
 * button to offer again.
 */
export class AttemptRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AttemptRequestError';
  }
}

async function post<TResponse>(url: string, body?: unknown): Promise<TResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AttemptRequestError(
      problem?.error ?? `Request failed with ${res.status}`,
      res.status,
    );
  }
  return res.json() as Promise<TResponse>;
}

/**
 * The last finished attempt at this exercise, or `null` if there is none.
 *
 * A plain function rather than a hook, because the runner asks for it at one moment —
 * just after the attempt opens, when there are finally gaps for a saved answer to go
 * into — and not as state to be watched. It never rejects: a history lookup that fails
 * leaves the learner where they would have been anyway, at an exercise with nothing
 * restored, and that is not worth an error screen over a working exercise.
 */
export async function fetchLastAttempt(exerciseId: string): Promise<AttemptRecord | null> {
  try {
    const res = await fetch(`/api/exercises/${exerciseId}/attempts`);
    if (!res.ok) return null;
    const data = (await res.json()) as LastAttemptResponse;
    return data.attempt ?? null;
  } catch {
    return null;
  }
}

/**
 * How a failed `submit` actually left things (47.0.B).
 *
 * A failed check does not mean a failed submission: the engine has already accepted the
 * work by the time it is scored or routed, so a request that reaches that far and then
 * loses its response on the way back must not be treated the same as one that never
 * arrived. `'delivered'` — the attempt moved on without this screen's help, and the
 * right thing is to say so, calmly, with no button. `'not-delivered'` — nothing
 * happened; the work is still in hand and worth another try. `'unconfirmed'` — even the
 * question could not be answered, so neither "sent" nor "lost" would be honest; only
 * "couldn't tell" is.
 */
export type SubmitFailureResolution = 'delivered' | 'not-delivered' | 'unconfirmed';

function resolveByStatus(status: AttemptStatus): SubmitFailureResolution {
  return status === 'ROUTED_FOR_REVIEW' || status === 'SCORED' ? 'delivered' : 'not-delivered';
}

/**
 * Asks the engine what became of an attempt after its `submit` call failed. Never
 * rejects: a check that itself fails to answer is exactly the case this exists to
 * report, not a reason to throw past the caller.
 */
export async function resolveSubmitFailure(
  exerciseId: string,
  attemptId: string,
): Promise<SubmitFailureResolution> {
  try {
    const res = await fetch(`/api/exercises/${exerciseId}/attempts/${attemptId}`);
    if (!res.ok) return 'unconfirmed';
    const data = (await res.json()) as AttemptStatusResponse;
    return resolveByStatus(data.status);
  } catch {
    return 'unconfirmed';
  }
}

export function useStartAttempt(exerciseId: string) {
  return useMutation<StartAttemptResponse, Error, StartAttemptRequest>({
    mutationFn: (body) => post(`/api/exercises/${exerciseId}/attempts`, body),
  });
}

export function useSubmitAnswer(exerciseId: string, attemptId: string | null) {
  return useMutation<SubmitAnswerResponse, Error, SubmitAnswerRequest>({
    mutationFn: (body) => {
      if (attemptId === null) throw new Error('No attempt in progress');
      return post(`/api/exercises/${exerciseId}/attempts/${attemptId}/submit`, body);
    },
  });
}

/**
 * The mid-attempt "how am I doing?" of `error_correction`.
 *
 * A mutation, and not only for the write it makes: each call spends one of the
 * author's self-checks, so it must happen when the learner asks and never as a
 * refetch behind their back.
 */
export function useSelfCheck(exerciseId: string, attemptId: string | null) {
  return useMutation<SelfCheckResponse, Error, SelfCheckRequest>({
    mutationFn: (body) => {
      if (attemptId === null) throw new Error('No attempt in progress');
      return post(`/api/exercises/${exerciseId}/attempts/${attemptId}/self-check`, body);
    },
  });
}

export function useRevealAnswers(exerciseId: string, attemptId: string | null) {
  return useMutation<RevealAnswersResponse, Error, void>({
    mutationFn: () => {
      if (attemptId === null) throw new Error('No attempt in progress');
      return post(`/api/exercises/${exerciseId}/attempts/${attemptId}/reveal`);
    },
  });
}
