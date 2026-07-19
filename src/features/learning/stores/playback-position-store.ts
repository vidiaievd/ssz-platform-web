'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlaybackPositionState {
  /** media key (source URL) -> last playback position, in seconds. */
  positions: Record<string, number>;
  getPosition: (key: string) => number;
  setPosition: (key: string, seconds: number) => void;
}

/**
 * Cross-visit playback position for `<audio>`/`<video>` elements — shared by
 * `AudioPlayer` and `VideoPlayer` via `useMediaPlayer` (FE6.1's "one AudioBar").
 */
export const usePlaybackPositionStore = create<PlaybackPositionState>()(
  persist(
    (set, get) => ({
      positions: {},
      getPosition: (key) => get().positions[key] ?? 0,
      setPosition: (key, seconds) =>
        set((state) => ({ positions: { ...state.positions, [key]: seconds } })),
    }),
    { name: 'ssz:learning:playback-position:v1' },
  ),
);
