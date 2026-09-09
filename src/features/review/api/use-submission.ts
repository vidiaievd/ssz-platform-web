'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import type { ReviewLockState, ReviewSubmission } from '../types';

import { reviewKeys } from './keys';

/**
 * One submission, live.
 *
 * Not cached for long and always refetched on focus: the breakdown is recomputed upstream
 * on every read, so an author who fixed an answer key while this tab sat open should
 * change what the teacher sees the moment they come back to it.
 */
export function useSubmission(school: string, id: string | null) {
  return useQuery<ReviewSubmission>({
    queryKey: reviewKeys.submission(school, id ?? ''),
    queryFn: async () => {
      const response = await fetch(
        `/api/review/submissions/${id}?school=${encodeURIComponent(school)}`,
      );
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<ReviewSubmission>;
    },
    enabled: school !== '' && id !== null,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

/** Renew no more than once a minute, however much typing happens in between. */
const ACTIVITY_THROTTLE_MS = 60_000;
export interface ReviewLockLifecycle {
  /** Who holds the submission now — the caller, or a colleague, or nobody. */
  state: ReviewLockState | null;
  /** The caller's own marker ran out while the screen stayed open (criterion 25). */
  expired: boolean;
}

/**
 * Hold the submission while it is being read, and let go when it is not.
 *
 * The marker is a courtesy to the other teacher of the group, not a lock: it is placed on
 * open, extended when the reviewer does something — typing, scrolling — and dropped both
 * when the screen closes and when the tab does. Nothing is renewed by a background timer,
 * because a tab left open over lunch should not go on claiming work nobody is doing.
 *
 * Expiry is announced rather than absorbed. A reviewer who comes back to a submission the
 * marker has run out on is told so; the alternative is a verdict that collides with a
 * colleague's for reasons the screen had already known about and kept to itself.
 */
export function useReviewLock(
  school: string,
  id: string | null,
  { enabled = true }: { enabled?: boolean } = {},
): ReviewLockLifecycle {
  // Which window ran out, rather than a boolean: a fresh claim carries a new `expiresAt`,
  // so the flag clears itself instead of needing a reset the effect would have to write.
  const [expiredWindow, setExpiredWindow] = useState<string | null>(null);
  const lastClaimRef = useRef(0);

  const url =
    id === null ? null : `/api/review/submissions/${id}/lock?school=${encodeURIComponent(school)}`;

  /**
   * Claiming, as a mutation: its answer is who holds the submission now, and that answer
   * is what the screen renders. A failure is swallowed on purpose — a marker that could
   * not be placed costs a line on a colleague's row and nothing else.
   */
  const lock = useMutation<ReviewLockState, Error>({
    mutationFn: async () => {
      if (url === null) return { lock: null, mine: false };
      const response = await fetch(url, { method: 'POST' });
      if (!response.ok) return { lock: null, mine: false };
      return (await response.json()) as ReviewLockState;
    },
    onError: () => {},
  });

  const claim = lock.mutate;

  useEffect(() => {
    if (!enabled || url === null) return;
    const lockUrl = url;

    lastClaimRef.current = Date.now();
    claim();

    // Activity, not a heartbeat: the window is only pushed forward by someone actually
    // working, and at most once a minute however much typing happens in between. A tab
    // left open over lunch stops claiming work nobody is doing.
    const onActivity = () => {
      const now = Date.now();
      if (now - lastClaimRef.current < ACTIVITY_THROTTLE_MS) return;
      lastClaimRef.current = now;
      claim();
    };

    window.addEventListener('keydown', onActivity);
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('scroll', onActivity, true);
    window.addEventListener('beforeunload', release);

    /**
     * Letting go, deliberately outside react-query: this runs while the screen is being
     * torn down or the tab is closing, where there is no component left to hand a result
     * to. `keepalive` is what makes it survive the navigation that triggered it — without
     * it the request is cancelled and the submission stays marked for the full window.
     */
    function release() {
      void fetch(lockUrl, { method: 'DELETE', keepalive: true }).catch(() => {});
    }

    return () => {
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('scroll', onActivity, true);
      window.removeEventListener('beforeunload', release);
      release();
    };
  }, [claim, enabled, url]);

  const state = lock.data ?? null;
  const expiresAt = state?.mine === true ? (state.lock?.expiresAt ?? null) : null;

  // One timer, and it announces rather than renews: a reviewer whose marker has run out is
  // told so, instead of finding out through a colleague's verdict landing on their work.
  useEffect(() => {
    if (expiresAt === null) return;

    const timer = setTimeout(
      () => setExpiredWindow(expiresAt),
      Math.max(Date.parse(expiresAt) - Date.now(), 0),
    );
    return () => clearTimeout(timer);
  }, [expiresAt]);

  return { state, expired: expiresAt !== null && expiredWindow === expiresAt };
}
