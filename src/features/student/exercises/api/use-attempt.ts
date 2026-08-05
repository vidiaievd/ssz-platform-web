'use client';

import { useMutation } from '@tanstack/react-query';

import type {
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
