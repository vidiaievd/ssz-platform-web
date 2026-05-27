'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InviteRowValues } from '../schemas';

export type WizardStep = 'basics' | 'invite' | 'done';

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
  step: WizardStep;
  schoolId: string | null;
  idempotencyKey: string;
  basicsDraft: BasicsDraft;
  invitesDraft: InviteRowValues[];
  isSaving: boolean;
  lastError: string | null;
  descriptionTab: 'write' | 'preview';
};

type WizardActions = {
  setStep: (step: WizardStep) => void;
  setSchoolId: (id: string) => void;
  setBasicsDraft: (data: Partial<BasicsDraft>) => void;
  setInvitesDraft: (rows: InviteRowValues[]) => void;
  setIsSaving: (v: boolean) => void;
  setLastError: (e: string | null) => void;
  setDescriptionTab: (tab: 'write' | 'preview') => void;
  reset: () => void;
};

const emptyRow: InviteRowValues = { email: '', role: 'STUDENT' };

const initialState: WizardState = {
  step: 'basics',
  schoolId: null,
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
  invitesDraft: [emptyRow],
  isSaving: false,
  lastError: null,
  descriptionTab: 'write',
};

export const useCreateWizardStore = create<WizardState & WizardActions>()(
  persist(
    (set) => ({
      ...initialState,
      setStep: (step) => set({ step }),
      setSchoolId: (schoolId) => set({ schoolId }),
      setBasicsDraft: (data) =>
        set((s) => ({ basicsDraft: { ...s.basicsDraft, ...data } })),
      setInvitesDraft: (invitesDraft) => set({ invitesDraft }),
      setIsSaving: (isSaving) => set({ isSaving }),
      setLastError: (lastError) => set({ lastError }),
      setDescriptionTab: (descriptionTab) => set({ descriptionTab }),
      reset: () =>
        set({ ...initialState, idempotencyKey: crypto.randomUUID() }),
    }),
    {
      name: 'ssz:school:create:v1',
      partialize: (s) => ({
        step: s.step,
        schoolId: s.schoolId,
        idempotencyKey: s.idempotencyKey,
        basicsDraft: s.basicsDraft,
        invitesDraft: s.invitesDraft,
      }),
    },
  ),
);
