'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type OnboardingRole = 'student' | 'tutor';
export type TargetLanguage = { code: string; level: CEFRLevel };

export type ProfileDraft = {
  displayName: string;
  firstName: string;
  lastName: string;
  timezone: string;
  locale: string;
  bio: string;
};

export type LanguagesDraft = {
  nativeLanguage: string;
  targetLanguages: TargetLanguage[];
};

type OnboardingState = {
  role: OnboardingRole | null;
  profileDraft: ProfileDraft;
  languagesDraft: LanguagesDraft;
  isSaving: boolean;
  lastError: string | null;
};

type OnboardingActions = {
  setRole: (role: OnboardingRole) => void;
  setProfileDraft: (data: Partial<ProfileDraft>) => void;
  setLanguagesDraft: (data: Partial<LanguagesDraft>) => void;
  setIsSaving: (v: boolean) => void;
  setLastError: (e: string | null) => void;
  reset: () => void;
};

const initialState: OnboardingState = {
  role: null,
  profileDraft: { displayName: '', firstName: '', lastName: '', timezone: 'UTC', locale: 'en', bio: '' },
  languagesDraft: { nativeLanguage: '', targetLanguages: [] },
  isSaving: false,
  lastError: null,
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  persist(
    (set) => ({
      ...initialState,
      setRole: (role) => set({ role }),
      setProfileDraft: (data) =>
        set((s) => ({ profileDraft: { ...s.profileDraft, ...data } })),
      setLanguagesDraft: (data) =>
        set((s) => ({ languagesDraft: { ...s.languagesDraft, ...data } })),
      setIsSaving: (isSaving) => set({ isSaving }),
      setLastError: (lastError) => set({ lastError }),
      reset: () => set(initialState),
    }),
    { name: 'ssz:onboarding:v1' },
  ),
);
