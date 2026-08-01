'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { GlossVisibility } from '@/features/learning';

/** Text lesson reading experience (design handoff §"Reader Text Lesson"). */
export type ReadingMode = 'immersive' | 'bilingual' | 'focus';

/** How wide the prose column is allowed to grow. */
export type TextWidth = 'narrow' | 'medium' | 'wide';

/**
 * Column caps in px, including the container's 32px side padding.
 *
 * At the reader's 19px serif these are roughly 66 / 81 / 105 characters per
 * line. Typographic advice puts comfortable reading at 60–75, so `narrow` is
 * the textbook answer and `wide` is knowingly past it — offered because on a
 * 1900px screen a 680px column reads as a wasted screen no matter what the
 * measure rule says, and that judgement belongs to the reader.
 */
export const TEXT_WIDTH_PX: Record<TextWidth, number> = {
  narrow: 680,
  medium: 820,
  wide: 1040,
};

interface ReadingModeState {
  /** `null` means the student never chose — the reader falls back to a level-based default. */
  mode: ReadingMode | null;
  setMode: (mode: ReadingMode) => void;
  /** Which glossed words get marked up. Unlike `mode` this has a real default, not a derived one. */
  glossVisibility: GlossVisibility;
  setGlossVisibility: (visibility: GlossVisibility) => void;
  textWidth: TextWidth;
  setTextWidth: (width: TextWidth) => void;
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
      // 'medium', not the typographic optimum: with the contents sidebar and
      // the rail both taking a column, the strict 680px measure left ~300px of
      // dead space on each side of the prose.
      textWidth: 'medium',
      setTextWidth: (textWidth) => set({ textWidth }),
    }),
    // Key stays at v2 — persisted v2 payloads simply lack `glossVisibility`, and
    // persist's shallow merge leaves the default in place for them.
    { name: 'ssz:reader:reading-mode:v2' },
  ),
);
