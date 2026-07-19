'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Text lesson reading experience (design handoff §"Reader Text Lesson"). */
export type ReadingMode = 'immersive' | 'bilingual' | 'focus';

interface ReadingModeState {
  mode: ReadingMode;
  setMode: (mode: ReadingMode) => void;
}

/**
 * A real per-user preference (not component state) — persisted client-side
 * since no backend field exists for it yet. The design's "Tweaks panel" that
 * toggled this in the prototype must not be ported; this store is the real
 * app-configuration equivalent (README §"Variants that must become real
 * settings").
 */
export const useReadingModeStore = create<ReadingModeState>()(
  persist(
    (set) => ({
      mode: 'immersive',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'ssz:reader:reading-mode:v1' },
  ),
);
