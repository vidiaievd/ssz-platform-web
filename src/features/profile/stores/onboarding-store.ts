'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { CEFRLevel } from '../lib/cefr-levels';

export type { CEFRLevel } from '../lib/cefr-levels';
export { CEFR_LEVELS } from '../lib/cefr-levels';
export type OnboardingRole = 'student' | 'tutor';
export type TargetLanguage = { code: string; level?: CEFRLevel };

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

export type TutorDraft = {
  teachingLanguages: Array<{ code: string; proficiency: string }>;
  hourlyRate: number | null;
  specializations: string[];
};

type OnboardingState = {
  profileDraft: ProfileDraft;
  languagesDraft: LanguagesDraft;
  tutorDraft: TutorDraft;
  isSaving: boolean;
  lastError: string | null;
};

type OnboardingActions = {
  setProfileDraft: (data: Partial<ProfileDraft>) => void;
  setLanguagesDraft: (data: Partial<LanguagesDraft>) => void;
  setTutorDraft: (data: Partial<TutorDraft>) => void;
  setIsSaving: (v: boolean) => void;
  setLastError: (e: string | null) => void;
  reset: () => void;
};

const initialState: OnboardingState = {
  profileDraft: { displayName: '', firstName: '', lastName: '', timezone: 'UTC', locale: 'en', bio: '' },
  languagesDraft: { nativeLanguage: '', targetLanguages: [] },
  tutorDraft: { teachingLanguages: [], hourlyRate: null, specializations: [] },
  isSaving: false,
  lastError: null,
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  persist(
    (set) => ({
      ...initialState,
      setProfileDraft: (data) =>
        set((s) => ({ profileDraft: { ...s.profileDraft, ...data } })),
      setLanguagesDraft: (data) =>
        set((s) => ({ languagesDraft: { ...s.languagesDraft, ...data } })),
      setTutorDraft: (data) =>
        set((s) => ({ tutorDraft: { ...s.tutorDraft, ...data } })),
      setIsSaving: (isSaving) => set({ isSaving }),
      setLastError: (lastError) => set({ lastError }),
      reset: () => set(initialState),
    }),
    { name: 'ssz:onboarding:v2' },
  ),
);
