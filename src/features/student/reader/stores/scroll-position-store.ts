'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ScrollPositionState {
  /** `${lessonId}:${variantId}` -> last scrollTop, in pixels. */
  positions: Record<string, number>;
  getPosition: (key: string) => number;
  setPosition: (key: string, pixels: number) => void;
}

/**
 * Cross-visit scroll position for long texts in the reader — same pattern as
 * `usePlaybackPositionStore` (features/learning), applied to scroll instead
 * of media time.
 */
export const useScrollPositionStore = create<ScrollPositionState>()(
  persist(
    (set, get) => ({
      positions: {},
      getPosition: (key) => get().positions[key] ?? 0,
      setPosition: (key, pixels) =>
        set((state) => ({ positions: { ...state.positions, [key]: pixels } })),
    }),
    { name: 'ssz:reader:scroll-position:v1' },
  ),
);
