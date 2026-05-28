'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BasicsDraft = {
  name: string;
  slug: string;
  slugEditedByUser: boolean;
  description: string;
  logoUrl: string;
  website: string;
  contactEmail: string;
  city: string;
};

type WizardState = {
  idempotencyKey: string;
  basicsDraft: BasicsDraft;
  isSaving: boolean;
  lastError: string | null;
};

type WizardActions = {
  setBasicsDraft: (data: Partial<BasicsDraft>) => void;
  setIsSaving: (v: boolean) => void;
  setLastError: (e: string | null) => void;
  reset: () => void;
};

const initialState: WizardState = {
  idempotencyKey: crypto.randomUUID(),
  basicsDraft: {
    name: '',
    slug: '',
    slugEditedByUser: false,
    description: '',
    logoUrl: '',
    website: '',
    contactEmail: '',
    city: '',
  },
  isSaving: false,
  lastError: null,
};

export const useCreateWizardStore = create<WizardState & WizardActions>()(
  persist(
    (set) => ({
      ...initialState,
      setBasicsDraft: (data) =>
        set((s) => ({ basicsDraft: { ...s.basicsDraft, ...data } })),
      setIsSaving: (isSaving) => set({ isSaving }),
      setLastError: (lastError) => set({ lastError }),
      reset: () =>
        set({ ...initialState, idempotencyKey: crypto.randomUUID() }),
    }),
    {
      name: 'ssz:school:create:v1',
      partialize: (s) => ({
        idempotencyKey: s.idempotencyKey,
        basicsDraft: s.basicsDraft,
      }),
    },
  ),
);
