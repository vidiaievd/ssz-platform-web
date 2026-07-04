'use client';

import { useEffect, useRef } from 'react';

/**
 * Each client-side navigation to a new page mounts a fresh heading instance
 * (App Router swaps the page subtree), so "has this component mounted
 * before in this session" is what distinguishes a route change from the
 * very first paint — module state survives across mounts, a ref would not.
 */
let hasMountedOnce = false;

/** Focuses the returned ref on every mount after the first one, i.e. on client-side route changes — not on initial page load. */
export function useFocusOnRouteChange<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (hasMountedOnce) {
      ref.current?.focus();
    }
    hasMountedOnce = true;
  }, []);

  return ref;
}
