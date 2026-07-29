'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { GlossVisibility } from '@/features/learning';

/** Text lesson reading experience (design handoff §"Reader Text Lesson"). */
export type ReadingMode = 'immersive' | 'bilingual' | 'focus';

interface ReadingModeState {
  /** `null` means the student never chose — the reader falls back to a level-based default. */
  mode: ReadingMode | null;
  setMode: (mode: ReadingMode) => void;
  /** Which glossed words get marked up. Unlike `mode` this has a real default, not a derived one. */
  glossVisibility: GlossVisibility;
  setGlossVisibility: (visibility: GlossVisibility) => void;
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
      mode: null,
      setMode: (mode) => set({ mode }),
      // 'unknown' by default: the point of glossing is what the reader has not
      // learned yet, and marking up already-retained words is visual noise.
      glossVisibility: 'unknown',
      setGlossVisibility: (glossVisibility) => set({ glossVisibility }),
    }),
    // Key stays at v2 — persisted v2 payloads simply lack `glossVisibility`, and
    // persist's shallow merge leaves the default in place for them.
    { name: 'ssz:reader:reading-mode:v2' },
  ),
);
