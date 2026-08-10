'use client';

import { useMutation } from '@tanstack/react-query';

import type {
  AttemptRecord,
  LastAttemptResponse,
  RevealAnswersResponse,
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

async function post<TResponse>(url: string, body?: unknown): Promise<TResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(problem?.error ?? `Request failed with ${res.status}`);
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

export function useRevealAnswers(exerciseId: string, attemptId: string | null) {
  return useMutation<RevealAnswersResponse, Error, void>({
    mutationFn: () => {
      if (attemptId === null) throw new Error('No attempt in progress');
      return post(`/api/exercises/${exerciseId}/attempts/${attemptId}/reveal`);
    },
  });
}
