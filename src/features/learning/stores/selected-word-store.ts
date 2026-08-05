'use client';

import { create } from 'zustand';

import type { VocabularyItem } from '@/features/content/types';

import { useSelectedAnnotationStore } from './selected-annotation-store';

export interface SelectedWord {
  item: VocabularyItem;
  /** The surface form met in the text — the paradigm cell to mark. */
  form?: string;
  /** Grammatical label of that form; null when the form is the lemma itself. */
  formLabel?: string | null;
  /** The sentence the word was read in, quoted back on the card. */
  contextSentence?: string;
}

interface SelectedWordState {
  selected: SelectedWord | null;
  select: (word: SelectedWord) => void;
  clear: () => void;
}

/**
 * The word whose card the rail is showing.
 *
 * Deliberately not persisted and deliberately global rather than per-lesson:
 * it is a transient "what am I looking at right now", and a card restored from
 * a previous session — pointing at a word from a text the reader has left —
 * would be worse than an empty rail.
 */
export const useSelectedWordStore = create<SelectedWordState>((set) => ({
  selected: null,
  // Clears the annotation card: the rail shows one card at a time, and the
  // reader's last click is what it answers. See [useSelectedAnnotationStore].
  select: (selected) => {
    useSelectedAnnotationStore.getState().clear();
    set({ selected });
  },
  clear: () => set({ selected: null }),
}));
