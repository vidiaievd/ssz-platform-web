'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { resolveSubmitFailure } from '@/features/student/exercises/api/use-attempt';
import type { StartAttemptResponse } from '@/features/student/exercises/types/attempts';

import { mySubmissionsKeys } from './keys';

/**
 * Handing an essay in again, from the card it came back in (plan 47.3).
 *
 * Two calls, because that is what the engine's flow is: an attempt is opened, then answered.
 * The interesting part is the middle — an attempt at this exercise may already be open,
 * left behind by a page that was closed before anything was submitted. That is a 409, and
 * it is *not* a failure: the BFF tries to clear it and start fresh, and when it cannot, it
 * hands back the running attempt's id. An attempt already open is one this answer can be
 * submitted into, so the id is picked up and the work carries on into it rather than the
 * learner being told to try later about something that is not their problem.
 */

/** What the failure amounted to, in the learner's terms. */
export type ResubmitFailure =
  /** Nothing was sent — the answer is still in the field, the button is worth pressing. */
  | 'not-sent'
  /** It did land, despite the error on the way back. Nothing more to do (47.0.B). */
  | 'delivered'
  /** Could not even be established. Neither "sent" nor "lost" would be honest. */
  | 'unconfirmed';

export class ResubmitError extends Error {
  constructor(readonly resolution: ResubmitFailure) {
    super(`resubmit failed: ${resolution}`);
    this.name = 'ResubmitError';
  }
}

export interface ResubmitInput {
  exerciseId: string;
  targetLanguage: string;
  /** The rewritten answer. One field, because this path is only for the templates that are one field. */
  text: string;
  /** How long this go took, for the record the teacher reads. */
  timeSpentSeconds: number;
  locale: string;
}

interface ConflictBody {
  error?: string;
  attemptId?: string;
}

/**
 * Opens an attempt, or adopts the one already open.
 *
 * A 409 without an id is the only case left with nothing to act on: the attempt exists,
 * this client cannot name it, and submitting blind would be guessing.
 */
async function startOrResume(exerciseId: string, language: string): Promise<string> {
  const response = await fetch(`/api/exercises/${exerciseId}/attempts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ language }),
  });

  if (response.ok) {
    const started = (await response.json()) as StartAttemptResponse;
    return started.attemptId;
  }

  if (response.status === 409) {
    const body = (await response.json().catch(() => null)) as ConflictBody | null;
    if (typeof body?.attemptId === 'string' && body.attemptId !== '') return body.attemptId;
  }

  throw new ResubmitError('not-sent');
}

export function useResubmit() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ResubmitInput>({
    mutationFn: async ({ exerciseId, targetLanguage, text, timeSpentSeconds, locale }) => {
      const attemptId = await startOrResume(exerciseId, targetLanguage);

      const response = await fetch(`/api/exercises/${exerciseId}/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          submittedAnswer: { text },
          timeSpentSeconds: Math.max(0, Math.round(timeSpentSeconds)),
          locale,
        }),
      });
      if (response.ok) return;

      // The same question 47.0 asks of every failed submit: did it land? A lost response
      // looks exactly like a lost request from here, and only the engine can tell them
      // apart — telling the learner to send an essay that is already with their teacher
      // would earn them a duplicate and a refusal.
      const resolution = await resolveSubmitFailure(exerciseId, attemptId);
      throw new ResubmitError(
        resolution === 'delivered'
          ? 'delivered'
          : resolution === 'unconfirmed'
            ? 'unconfirmed'
            : 'not-sent',
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mySubmissionsKeys.lists() });
    },
    onError: (error) => {
      // A submission that turned out to have landed changes the list as much as a
      // successful one does: the row is with a teacher again, whatever this screen saw.
      if (error instanceof ResubmitError && error.resolution === 'delivered') {
        void queryClient.invalidateQueries({ queryKey: mySubmissionsKeys.lists() });
      }
    },
  });
}
