'use client';

import { create } from 'zustand';

/**
 * Which groups are folded shut, and nothing else.
 *
 * This is the one piece of the inbox's state that is deliberately kept out of the URL.
 * Folding a group is a way of getting it out of the way for a minute; it is not a view
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
}

export const useReviewViewStore = create<ReviewViewState>((set, get) => ({
  collapsed: {},
  isCollapsed: (key) => get().collapsed[key] === true,
  toggleGroup: (key) =>
    set((state) => ({ collapsed: { ...state.collapsed, [key]: !state.collapsed[key] } })),
  expandAll: () => set({ collapsed: {} }),
}));
