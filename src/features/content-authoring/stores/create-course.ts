import { createStore } from '@/stores/create-store';

export type CreateCourseFlow = 'wizard' | 'quick';
export type LevelSystem = 'cefr' | 'custom' | 'single';
export type Starter = 'blank' | 'cefr' | 'clone';

export interface BasicsDraft {
  title: string;
  targetLanguage: string;
  description: string;
}

const INITIAL_BASICS: BasicsDraft = {
  title: '',
  targetLanguage: '',
  description: '',
};

export const DEFAULT_CEFR_LEVELS = [
  'A1 — Beginner',
  'A2 — Elementary',
  'B1 — Intermediate',
  'B2 — Upper-Intermediate',
  'C1 — Advanced',
  'C2 — Proficient',
];

const INITIAL_LEVEL_SYSTEM: LevelSystem = 'cefr';
const INITIAL_STARTER: Starter = 'cefr';

export interface CreateCourseStore {
  flow: CreateCourseFlow;
  /** Wizard-only: 0 = Basics, 1 = Levels, 2 = Starter. */
  step: number;
  isCreating: boolean;
  basics: BasicsDraft;
  levelSystem: LevelSystem;
  starter: Starter;

  setFlow: (flow: CreateCourseFlow) => void;
  setStep: (step: number) => void;
  updateBasics: (patch: Partial<BasicsDraft>) => void;
  setLevelSystem: (levelSystem: LevelSystem) => void;
  setStarter: (starter: Starter) => void;
  setCreating: (isCreating: boolean) => void;
  reset: () => void;
}

export const useCreateCourseStore = createStore<CreateCourseStore>(
  'create-course',
  (set) => ({
    flow: 'wizard',
    step: 0,
    isCreating: false,
    basics: INITIAL_BASICS,
    levelSystem: INITIAL_LEVEL_SYSTEM,
    starter: INITIAL_STARTER,

    setFlow: (flow) => set({ flow }),
    setStep: (step) => set({ step }),
    updateBasics: (patch) => set((s) => ({ basics: { ...s.basics, ...patch } })),
    setLevelSystem: (levelSystem) => set({ levelSystem }),
    setStarter: (starter) => set({ starter }),
    setCreating: (isCreating) => set({ isCreating }),
    reset: () =>
      set({
        flow: 'wizard',
        step: 0,
        isCreating: false,
        basics: INITIAL_BASICS,
        levelSystem: INITIAL_LEVEL_SYSTEM,
        starter: INITIAL_STARTER,
      }),
  }),
);
