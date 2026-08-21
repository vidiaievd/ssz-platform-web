'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * The measured width of the element the returned ref is attached to.
 *
 * For layouts that have to answer "how much room do *I* have", not "how wide is
 * the window" — a component rendered inside a 284px preview frame on a desktop
 * screen gets the same answer from `matchMedia` as one filling the page, and
 * lays itself out for a room it is not in.
 *
 * 0 until measured, which is deliberately the narrow branch: guessing wide and
 * correcting on mount would show the desktop layout for a frame to exactly the
 * people it fits worst.
 */
export function useContainerWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
