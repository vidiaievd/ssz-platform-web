'use client';

import { create } from 'zustand';

/**
 * Which groups are folded shut, and where a verdict has just sent the reviewer.
 *
 * Both are deliberately kept out of the URL. Folding a group is a way of getting it out
 * of the way for a minute; it is not a view
 * worth sharing, and routing every chevron through the router would put a history entry
 * behind each one and make the back button undo folds instead of navigation.
 *
 * Collapsed rather than expanded is stored, so that a group appearing for the first time —
 * a learner who just handed something in — is open by default without anyone having to
 * add it here.
 */
interface ReviewViewState {
  collapsed: Record<string, boolean>;
  isCollapsed: (key: string) => boolean;
  toggleGroup: (key: string) => void;
  expandAll: () => void;
  /**
   * The submission the reviewer was *sent* to, rather than one they clicked.
   *
   * After a verdict the panel is replaced under the reader's hands, and a screen reader
   * left on the old heading would announce nothing at all about the new work. The panel
   * for this id takes focus to its heading on arrival and clears the flag; a submission
   * opened by clicking a row sets nothing, because the click already moved focus.
   */
  arrivedAt: string | null;
  announceArrival: (attemptId: string) => void;
  clearArrival: () => void;
}

export const useReviewViewStore = create<ReviewViewState>((set, get) => ({
  collapsed: {},
  isCollapsed: (key) => get().collapsed[key] === true,
  toggleGroup: (key) =>
    set((state) => ({ collapsed: { ...state.collapsed, [key]: !state.collapsed[key] } })),
  expandAll: () => set({ collapsed: {} }),

  arrivedAt: null,
  announceArrival: (attemptId) => set({ arrivedAt: attemptId }),
  clearArrival: () => set({ arrivedAt: null }),
}));
