import type { CEFR } from '@/features/groups/types';

/** Score thresholds (inclusive lower bound) per CEFR level, descending. */
const THRESHOLDS: Array<{ min: number; level: CEFR }> = [
  { min: 90, level: 'C2' },
  { min: 76, level: 'C1' },
  { min: 61, level: 'B2' },
  { min: 46, level: 'B1' },
  { min: 31, level: 'A2' },
  { min: 0,  level: 'A1' },
];

/** Maps a raw score (0–100) to a CEFR level. */
export function scoreToCefr(score: number): CEFR {
  for (const { min, level } of THRESHOLDS) {
    if (score >= min) return level;
  }
  return 'A1';
}

/** Inverse: minimum score required to reach a given CEFR level. */
export function cefrMinScore(level: CEFR): number {
  return THRESHOLDS.find((t) => t.level === level)?.min ?? 0;
}
