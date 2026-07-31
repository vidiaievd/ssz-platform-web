'use client';

import { useEffect, useRef } from 'react';

import { useScrollPositionStore } from '../stores/scroll-position-store';

/** Position is persisted at most this often while scrolling, to limit localStorage writes. */
const PERSIST_INTERVAL_MS = 2000;

/**
 * The reader's scroll container is the `overflow-auto` div in `reader-shell.tsx`,
 * an ancestor of the page component rather than something the page renders
 * itself. Found by class instead of a threaded ref/prop so this stays a
 * page-level concern without touching reader-shell's layout.
 */
function findScrollContainer(node: HTMLElement | null): HTMLElement | null {
  return node?.closest<HTMLElement>('.overflow-auto') ?? null;
}

/**
 * Restores scroll position on entering a long text and persists it while
 * reading — same restore/throttled-persist shape as `useMediaPlayer`'s
 * position tracking, applied to `scrollTop` instead of `currentTime`.
 */
export function useScrollRestoration(
  anchorRef: React.RefObject<HTMLElement | null>,
  persistKey: string | undefined,
  ready: boolean,
) {
  const restoredKeyRef = useRef<string | undefined>(undefined);
  const lastPersistAtRef = useRef(0);
  const getPosition = useScrollPositionStore((s) => s.getPosition);
  const setPosition = useScrollPositionStore((s) => s.setPosition);

  useEffect(() => {
    if (!ready || !persistKey) return;
    const container = findScrollContainer(anchorRef.current);
    if (!container) return;

    const persistNow = () => setPosition(persistKey, container.scrollTop);

    if (restoredKeyRef.current !== persistKey) {
      restoredKeyRef.current = persistKey;
      const resumeAt = getPosition(persistKey);
      if (resumeAt > 0) container.scrollTop = resumeAt;
    }

    const onScroll = () => {
      const now = Date.now();
      if (now - lastPersistAtRef.current > PERSIST_INTERVAL_MS) {
        lastPersistAtRef.current = now;
        persistNow();
      }
    };
    container.addEventListener('scroll', onScroll);
    return () => {
      container.removeEventListener('scroll', onScroll);
      persistNow();
    };
  }, [anchorRef, persistKey, ready, getPosition, setPosition]);
}
