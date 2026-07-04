import type { PlacementLevelId, PlacementDirection } from './types';

export const PLACEMENT_LEVELS: readonly PlacementLevelId[] = ['A1', 'A2', 'B1', 'B2'];

/** Start at A2 (index 1) — a reasonable midpoint; most students aren't complete beginners. */
export const PLACEMENT_START_INDEX = 1;

/** Exactly 5 questions per session. */
export const PLACEMENT_QUESTION_COUNT = 5;

/**
 * Default level → first module to start at.
 * B10 README: illustrative for "Norwegian · Everyday life" — callers should
 * inject per-course data via the `levelToModule` parameter where available.
 */
export const DEFAULT_LEVEL_TO_MODULE: Readonly<Record<PlacementLevelId, number>> = {
  A1: 1,
  A2: 3,
  B1: 4,
  B2: 6,
};

/** Return the next level index after an answer, clamped to [0, 3]. */
export function nextLevelIndex(current: number, wasCorrect: boolean): number {
  return wasCorrect
    ? Math.min(current + 1, PLACEMENT_LEVELS.length - 1)
    : Math.max(current - 1, 0);
}

/** Derive the directional chip label from the old vs new level index. */
export function directionFor(prev: number, next: number): PlacementDirection {
  if (next > prev) return 'up';
  if (next < prev) return 'down';
  return null;
}

/** Map a numeric level index to its PlacementLevelId string. */
export function levelIdAt(index: number): PlacementLevelId {
  return PLACEMENT_LEVELS[index] as PlacementLevelId;
}

/**
 * Compute the final placement result from the level index at test end.
 * @param finalLevelIndex - level index after the 5th answer (0–3)
 * @param levelToModule   - per-course override; defaults to DEFAULT_LEVEL_TO_MODULE
 */
export function computePlacementResult(
  finalLevelIndex: number,
  levelToModule: Readonly<Record<PlacementLevelId, number>> = DEFAULT_LEVEL_TO_MODULE,
): { levelId: PlacementLevelId; moduleIndex: number } {
  const levelId = levelIdAt(finalLevelIndex);
  return { levelId, moduleIndex: levelToModule[levelId] };
}
