'use client';

import { create } from 'zustand';

interface KnownWordsState {
  known: Set<string>;
  markKnown: (vocabularyItemId: string) => void;
  unmarkKnown: (vocabularyItemId: string) => void;
}

/**
 * Optimistic "I know this word" state for the reader (plan 31 §B3). Not
 * persisted — the SRS card state on the server is the source of truth; this
 * only bridges the gap until the reader reads real card states (plan 31 §C3),
 * which replaces this store outright.
 */
export const useKnownWordsStore = create<KnownWordsState>((set) => ({
  known: new Set(),
  markKnown: (vocabularyItemId) =>
    set((state) => {
      const known = new Set(state.known);
      known.add(vocabularyItemId);
      return { known };
    }),
  unmarkKnown: (vocabularyItemId) =>
    set((state) => {
      const known = new Set(state.known);
      known.delete(vocabularyItemId);
      return { known };
    }),
}));
