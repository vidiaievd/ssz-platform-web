'use client';

import { create } from 'zustand';

import type { LessonSpanKind } from '@/features/content/types';

import { useSelectedWordStore } from './selected-word-store';

export interface SelectedAnnotation {
  /** Only the two kinds that carry an explanation; `vocab` has its own card. */
  kind: Exclude<LessonSpanKind, 'vocab'>;
  /** The annotated words, quoted back as the card's subject. */
  surface: string;
  note?: string | null;
  /** Grammar rule id; null for a chunk. */
  refId?: string | null;
}

interface SelectedAnnotationState {
  selected: SelectedAnnotation | null;
  select: (annotation: SelectedAnnotation) => void;
  clear: () => void;
}

/**
 * The annotation whose card the rail is showing.
 *
 * The rail holds one card at a time — a word's or an annotation's — so opening
 * one closes the other. Stacking both would push whichever the reader did not
 * just ask for off the bottom of a column they cannot see all of anyway, and
 * would leave two "what am I looking at" answers on screen at once.
 *
 * Kept as two stores rather than one union so each card keeps reading only what
 * it understands; the exclusivity lives in these two `select` calls.
 *
 * Transient and unpersisted: a card restored from a previous session would
 * describe a text the reader has since left.
 */
export const useSelectedAnnotationStore = create<SelectedAnnotationState>((set) => ({
  selected: null,
  select: (selected) => {
    useSelectedWordStore.getState().clear();
    set({ selected });
  },
  clear: () => set({ selected: null }),
}));
