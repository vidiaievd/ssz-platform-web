import { createStore } from '@/stores/create-store';

export type StructureMode = 'cefr_scaffold' | 'blank' | 'template';
export type VisibilityMode = 'public_catalog' | 'invite_only' | 'internal_draft';

export interface MetadataDraft {
  title: string;
  targetLanguage: string;
  level: string;
  slug: string;
  description: string;
  coverImageUrl: string;
}

export interface StructureDraft {
  mode: StructureMode;
  cefrLevels: string[];
  templateId: string;
}

export interface VisibilityDraft {
  mode: VisibilityMode;
  enrollmentOpens: string;
  enrollmentCloses: string;
  seatCap: string;
  prerequisiteId: string;
}

export const DEFAULT_CEFR_LEVELS = [
  'A1 — Beginner',
  'A2 — Elementary',
  'B1 — Intermediate',
  'B2 — Upper-Intermediate',
  'C1 — Advanced',
  'C2 — Proficient',
];

const INITIAL_METADATA: MetadataDraft = {
  title: '',
  targetLanguage: '',
  level: '',
  slug: '',
  description: '',
  coverImageUrl: '',
};

const INITIAL_STRUCTURE: StructureDraft = {
  mode: 'cefr_scaffold',
  cefrLevels: [...DEFAULT_CEFR_LEVELS],
  templateId: '',
};

const INITIAL_VISIBILITY: VisibilityDraft = {
  mode: 'invite_only',
  enrollmentOpens: 'immediately',
  enrollmentCloses: 'never',
  seatCap: 'unlimited',
  prerequisiteId: '',
};

export interface CreateWizardStore {
  step: number;
  draftId: string | null;
  isSaving: boolean;
  savedAt: Date | null;
  metadata: MetadataDraft;
  structure: StructureDraft;
  visibility: VisibilityDraft;

  setStep: (step: number) => void;
  setDraftId: (id: string) => void;
  markSaving: () => void;
  markSaved: () => void;
  updateMetadata: (patch: Partial<MetadataDraft>) => void;
  updateStructure: (patch: Partial<StructureDraft>) => void;
  updateVisibility: (patch: Partial<VisibilityDraft>) => void;
  reset: () => void;
}

export const useCreateWizardStore = createStore<CreateWizardStore>(
  'create-wizard',
  (set) => ({
    step: 0,
    draftId: null,
    isSaving: false,
    savedAt: null,
    metadata: INITIAL_METADATA,
    structure: INITIAL_STRUCTURE,
    visibility: INITIAL_VISIBILITY,

    setStep: (step) => set({ step }),
    setDraftId: (draftId) => set({ draftId }),
    markSaving: () => set({ isSaving: true }),
    markSaved: () => set({ isSaving: false, savedAt: new Date() }),
    updateMetadata: (patch) =>
      set((s) => ({ metadata: { ...s.metadata, ...patch } })),
    updateStructure: (patch) =>
      set((s) => ({ structure: { ...s.structure, ...patch } })),
    updateVisibility: (patch) =>
      set((s) => ({ visibility: { ...s.visibility, ...patch } })),
    reset: () =>
      set({
        step: 0,
        draftId: null,
        isSaving: false,
        savedAt: null,
        metadata: INITIAL_METADATA,
        structure: INITIAL_STRUCTURE,
        visibility: INITIAL_VISIBILITY,
      }),
  }),
);
