import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type NavHistoryState = {
  /**
   * Locale-agnostic path (no `/en` prefix) the user was on right before
   * entering the `/account/*` section. `null` when unknown (e.g. direct load).
   */
  returnPath: string | null;
  setReturnPath: (path: string | null) => void;
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
    }),
    {
      name: 'ssz-nav-history',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
