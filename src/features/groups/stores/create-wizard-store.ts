'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { todayISO } from '../lib/today-iso';
import type { AgeBand } from '../types';

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type CEFR = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type WizardTeacherRole = 'primary' | 'co-primary';

export type DraftSlot = {
  _id: string; // client-only key
  day: Weekday;
  start: string; // HH:MM
  end: string;   // HH:MM
  room: string;
};

export type DraftTeacher = {
  userId: string;
  role: WizardTeacherRole;
};

export type GroupWizardDraft = {
  courseId: string | null;
  courseName: string | null;
  lang: string;
  level: CEFR;
  name: string;
  mode: 'online' | 'in-person';
  capacity: { min: number; max: number };
  startDate: string;
  endDate: string;
  ageBand: AgeBand | null;
  slots: DraftSlot[];
  teachers: DraftTeacher[];
  studentIds: string[];
};

type WizardState = GroupWizardDraft & {
  currentStep: number;
  schoolId: string;
  isSubmitting: boolean;
  submitError: string | null;
};

type WizardActions = {
  initForSchool: (schoolId: string) => void;
  setStep: (step: number) => void;
  setField: <K extends keyof GroupWizardDraft>(key: K, value: GroupWizardDraft[K]) => void;
  addSlot: (slot: Omit<DraftSlot, '_id'>) => void;
  removeSlot: (id: string) => void;
  updateSlot: (id: string, patch: Partial<Omit<DraftSlot, '_id'>>) => void;
  addTeacher: (teacher: DraftTeacher) => void;
  removeTeacher: (userId: string) => void;
  setSubmitting: (v: boolean) => void;
  setSubmitError: (e: string | null) => void;
  reset: (schoolId: string) => void;
  isStepValid: (step: number) => boolean;
};

const BLANK_DRAFT: GroupWizardDraft = {
  courseId: null,
  courseName: null,
  lang: 'en',
  level: 'A1',
  name: '',
  mode: 'online',
  capacity: { min: 0, max: 12 },
  startDate: '',
  endDate: '',
  ageBand: null,
  slots: [],
  teachers: [],
  studentIds: [],
};

function makeInitialState(schoolId: string): WizardState {
  return {
    ...BLANK_DRAFT,
    currentStep: 0,
    schoolId,
    isSubmitting: false,
    submitError: null,
  };
}

export const useGroupCreateWizardStore = create<WizardState & WizardActions>()(
  persist(
    (set, get) => ({
      ...makeInitialState(''),

      initForSchool(schoolId) {
        const current = get();
        if (current.schoolId !== schoolId) {
          set(makeInitialState(schoolId));
        }
      },

      setStep: (step) => set({ currentStep: step }),

      setField: (key, value) => set({ [key]: value } as Partial<WizardState>),

      addSlot: (slot) =>
        set((s) => ({
          slots: [...s.slots, { ...slot, _id: crypto.randomUUID() }],
        })),

      removeSlot: (id) =>
        set((s) => ({ slots: s.slots.filter((sl) => sl._id !== id) })),

      updateSlot: (id, patch) =>
        set((s) => ({
          slots: s.slots.map((sl) => (sl._id === id ? { ...sl, ...patch } : sl)),
        })),

      addTeacher: (teacher) =>
        set((s) => {
          // Replace existing entry for same userId or same role
          const filtered = s.teachers.filter(
            (t) => t.userId !== teacher.userId && t.role !== teacher.role,
          );
          return { teachers: [...filtered, teacher] };
        }),

      removeTeacher: (userId) =>
        set((s) => ({ teachers: s.teachers.filter((t) => t.userId !== userId) })),

      setSubmitting: (isSubmitting) => set({ isSubmitting }),
      setSubmitError: (submitError) => set({ submitError }),

      reset: (schoolId) => set(makeInitialState(schoolId)),

      isStepValid(step) {
        const s = get();
        switch (step) {
          case 0: return true; // Course is optional
          case 1: {
            const nameOk = s.name.trim().length > 0 && s.name.trim().length <= 100;
            const capOk = s.capacity.min >= 0 && s.capacity.max >= 1 && s.capacity.max >= s.capacity.min;
            const startOk = !s.startDate || s.startDate >= todayISO();
            const endOk = !s.endDate || !s.startDate || s.endDate >= s.startDate;
            return nameOk && capOk && startOk && endOk;
          }
          case 2: {
            if (s.slots.length === 0) return false;
            return s.slots.every((sl) => {
              const [sh = 0, sm = 0] = sl.start.split(':').map(Number);
              const [eh = 0, em = 0] = sl.end.split(':').map(Number);
              const startMins = sh * 60 + sm;
              const endMins = eh * 60 + em;
              const timeOk = endMins > startMins;
              const roomOk = s.mode === 'online' || sl.room.trim().length > 0;
              return timeOk && roomOk;
            });
          }
          case 3: return s.teachers.some((t) => t.role === 'primary');
          case 4: return true; // Students optional
          case 5: return true; // Review
          default: return false;
        }
      },
    }),
    {
      name: 'ssz:groups:create:v1',
      partialize: (s) => ({
        schoolId: s.schoolId,
        currentStep: s.currentStep,
        courseId: s.courseId,
        courseName: s.courseName,
        lang: s.lang,
        level: s.level,
        name: s.name,
        mode: s.mode,
        capacity: s.capacity,
        startDate: s.startDate,
        endDate: s.endDate,
        ageBand: s.ageBand,
        slots: s.slots,
        teachers: s.teachers,
        studentIds: s.studentIds,
      }),
    },
  ),
);
