'use client';

import { useCallback, useState } from 'react';

import type { UnitPhase } from './types';

function phaseKey(unitId: string) {
  return `ssz_unit_flow_${unitId}_phase`;
}

function knownKey(unitId: string) {
  return `ssz_unit_flow_${unitId}_known`;
}

function readPhase(unitId: string): UnitPhase {
  if (typeof window === 'undefined') return 'read';
  const saved = localStorage.getItem(phaseKey(unitId));
  return (saved as UnitPhase | null) ?? 'read';
}

function readKnown(unitId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const saved = localStorage.getItem(knownKey(unitId));
    if (saved) return new Set(JSON.parse(saved) as string[]);
  } catch {
    // corrupt entry — ignore
  }
  return new Set();
}

export interface UseUnitPhaseReturn {
  phase: UnitPhase;
  knownWordIds: Set<string>;
  setPhase: (next: UnitPhase) => void;
  markKnown: (wordId: string) => void;
  clearSession: () => void;
}

export function useUnitPhase(unitId: string): UseUnitPhaseReturn {
  const [phase, setPhaseState] = useState<UnitPhase>(() => readPhase(unitId));
  const [knownWordIds, setKnownWordIds] = useState<Set<string>>(() => readKnown(unitId));

  const setPhase = useCallback(
    (next: UnitPhase) => {
      if (next === 'complete') {
        localStorage.removeItem(phaseKey(unitId));
        localStorage.removeItem(knownKey(unitId));
      } else {
        localStorage.setItem(phaseKey(unitId), next);
      }
      setPhaseState(next);
    },
    [unitId],
  );

  const markKnown = useCallback(
    (wordId: string) => {
      setKnownWordIds((prev) => {
        const next = new Set(prev);
        next.add(wordId);
        localStorage.setItem(knownKey(unitId), JSON.stringify([...next]));
        return next;
      });
    },
    [unitId],
  );

  const clearSession = useCallback(() => {
    localStorage.removeItem(phaseKey(unitId));
    localStorage.removeItem(knownKey(unitId));
  }, [unitId]);

  return { phase, knownWordIds, setPhase, markKnown, clearSession };
}
