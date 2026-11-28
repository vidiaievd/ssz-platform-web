import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type NavHistoryState = {
  /**
   * Locale-agnostic path (no `/en` prefix) the user was on right before
   * entering the `/account/*` section. `null` when unknown (e.g. direct load).
   */
  returnPath: string | null;
  setReturnPath: (path: string | null) => void;
  /**
   * Locale-agnostic path of the page before the current one, reached by a client-side
   * navigation in this document. `null` on a direct load or a reload — then there is no
   * in-app history entry behind the current page and `router.back()` would leave the app.
   * Kept in memory only (never persisted).
   */
  previousPath: string | null;
  setPreviousPath: (path: string | null) => void;
};

/**
 * Persisted to sessionStorage so a page refresh inside /account keeps the
 * "where to return" target. Cleared once the user leaves the account section.
 */
export const useNavHistoryStore = create<NavHistoryState>()(
  persist(
    (set) => ({
      returnPath: null,
      setReturnPath: (returnPath) => set({ returnPath }),
      previousPath: null,
      setPreviousPath: (previousPath) => set({ previousPath }),
    }),
    {
      name: 'ssz-nav-history',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ returnPath: state.returnPath }),
    },
  ),
);
