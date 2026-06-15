'use client';

import { createContext, useContext } from 'react';

export type UnsavedChangesContextValue = {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  guard: (proceed: () => void) => void;
};

export const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}
