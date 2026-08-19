'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { ProgressRecord, UpsertProgressRequest } from '../types';
import { learningKeys } from './keys';
import { dequeueProgress, enqueueProgress, readProgressOutbox } from '../lib/progress-outbox';

async function postProgress(body: UpsertProgressRequest): Promise<ProgressRecord> {
  const res = await fetch('/api/learning/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error('unauthenticated');
  if (!res.ok) throw new Error('Failed to save progress');
  return res.json() as Promise<ProgressRecord>;
}

function invalidateProgress(queryClient: QueryClient, courseId: string, unitId: string): void {
  void queryClient.invalidateQueries({ queryKey: learningKeys.unitContents(unitId) });
  void queryClient.invalidateQueries({ queryKey: learningKeys.courseHome(courseId) });
}

/**
 * Resends whatever pings are still sitting in the outbox (47.0). Best-effort:
 * an entry that fails again is simply left for the next trigger — mount,
 * `online`, a regained tab focus, or the next successful mutation.
 */
async function flushOutbox(queryClient: QueryClient, courseId: string, unitId: string): Promise<void> {
  const entries = readProgressOutbox();
  if (entries.length === 0) return;
  let flushedAny = false;
  for (const entry of entries) {
    try {
      await postProgress(entry);
      dequeueProgress(entry.contentId);
      flushedAny = true;
    } catch {
      // Left in the outbox for the next trigger to retry.
    }
  }
  if (flushedAny) invalidateProgress(queryClient, courseId, unitId);
}

/**
 * Upserts progress for one content item (BE3.3) — the footer "Next" action
 * marks the current item done, which flows into the unit-contents and
 * course-home progress read models. Invalidates both so the sidebar's
 * percent/status and the next item's lock state update immediately.
 *
 * A network failure here has no decision for the learner to make — the
 * checkbox they didn't write and can't diagnose — so it is handled entirely
 * without them (47.0): retried twice, then queued in `progress-outbox` and
 * resent silently the next time the reader gets a chance.
 */
export function useUpsertProgress(courseId: string, unitId: string) {
  const queryClient = useQueryClient();

  return useMutation<ProgressRecord, Error, UpsertProgressRequest>({
    mutationFn: postProgress,
    retry: (failureCount, error) => failureCount < 2 && error.message !== 'unauthenticated',
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    onSuccess: (_data, variables) => {
      dequeueProgress(variables.contentId);
      invalidateProgress(queryClient, courseId, unitId);
      // The connection that just carried this one home may carry the rest too.
      void flushOutbox(queryClient, courseId, unitId);
    },
    onError: (error, variables) => {
      // Unauthenticated has no queue to join — retrying it silently would just
      // resend a request the server will keep refusing.
      if (error.message === 'unauthenticated') return;
      enqueueProgress(variables);
    },
  });
}

/** A stable callback the reader can fire on mount, `online`, and focus regain. */
export function useFlushProgressOutbox(courseId: string, unitId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    () => flushOutbox(queryClient, courseId, unitId),
    [queryClient, courseId, unitId],
  );
}
