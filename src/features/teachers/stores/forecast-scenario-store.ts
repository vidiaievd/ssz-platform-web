'use client';

import { create } from 'zustand';

import { WORKLOAD_POLICY } from '@/lib/groups/operations';
import type { ForecastParams, ForecastResult, ForecastScenario } from '../types';

type ForecastScenarioState = {
  params: ForecastParams;
  result: ForecastResult | null;
  savedScenarios: ForecastScenario[];
  setParams: (params: Partial<ForecastParams>) => void;
  setResult: (result: ForecastResult) => void;
  addScenario: (scenario: ForecastScenario) => void;
  loadScenario: (scenario: ForecastScenario) => void;
};

const DEFAULT_PARAMS: ForecastParams = {
  growth: 0.1,
  terms: 4,
  groupSize: 8,
  hoursPerGroup: WORKLOAD_POLICY.HOURS_PER_GROUP_DEFAULT,
  contractPerTeacher: WORKLOAD_POLICY.CONTRACT_PER_TEACHER_DEFAULT,
};

export const useForecastScenarioStore = create<ForecastScenarioState>((set) => ({
  params: DEFAULT_PARAMS,
  result: null,
  savedScenarios: [],
  setParams: (partial) =>
    set((s) => ({ params: { ...s.params, ...partial } })),
  setResult: (result) => set({ result }),
  addScenario: (scenario) =>
    set((s) => ({ savedScenarios: [...s.savedScenarios, scenario] })),
  loadScenario: (scenario) =>
    set({ params: scenario.params, result: scenario.result }),
}));
