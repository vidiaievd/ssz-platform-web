'use client';

import { create } from 'zustand';

import type { SubstituteRequest, SubstituteCandidate } from '../types';

export type LastValidation = {
  requestId: string;
  passed: boolean;
  message: string | null;
};

type SubstitutionUiState = {
  selectedRequestId: string | null;
  selectedRequest: SubstituteRequest | null;
  candidates: SubstituteCandidate[];
  lastValidation: LastValidation | null;
  isBulkCovering: boolean;
  bulkProgress: { covered: number; flagged: number } | null;
  selectRequest: (request: SubstituteRequest) => void;
  clearSelection: () => void;
  setCandidates: (candidates: SubstituteCandidate[]) => void;
  setLastValidation: (v: LastValidation) => void;
  setBulkCovering: (active: boolean) => void;
  setBulkProgress: (progress: { covered: number; flagged: number } | null) => void;
};

export const useSubstitutionUiStore = create<SubstitutionUiState>((set) => ({
  selectedRequestId: null,
  selectedRequest: null,
  candidates: [],
  lastValidation: null,
  isBulkCovering: false,
  bulkProgress: null,
  selectRequest: (request) =>
    set({ selectedRequestId: request.requestId, selectedRequest: request, candidates: [], lastValidation: null }),
  clearSelection: () =>
    set({ selectedRequestId: null, selectedRequest: null, candidates: [], lastValidation: null }),
  setCandidates: (candidates) => set({ candidates }),
  setLastValidation: (v) => set({ lastValidation: v }),
  setBulkCovering: (active) => set({ isBulkCovering: active }),
  setBulkProgress: (progress) => set({ bulkProgress: progress }),
}));
