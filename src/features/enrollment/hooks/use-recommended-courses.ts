import { useMemo } from 'react';
import type { PlacementResult } from '@/features/enrollment/types';
import type { Container } from '@/features/content/types';
import type { LangCode, CEFR } from '@/features/groups/types';

// Adjacent levels we also surface so a slight over/underestimate still shows content.
const ADJACENT: Record<CEFR, CEFR[]> = {
  A1: ['A1', 'A2'],
  A2: ['A1', 'A2', 'B1'],
  B1: ['A2', 'B1', 'B2'],
  B2: ['B1', 'B2', 'C1'],
  C1: ['B2', 'C1', 'C2'],
  C2: ['C1', 'C2'],
};

export interface RecommendedCourse {
  course: Container;
  /** True when the course level matches the student's exact CEFR level. */
  isExactMatch: boolean;
}

/**
 * Filters and ranks a course catalogue against the student's platform placement
 * results for a given language. Returns exact-level matches first, then adjacent.
 *
 * Pass `language` to target a specific language; omit to use the student's
 * highest-confidence result across all languages.
 */
export function useRecommendedCourses(
  courses: Container[],
  placement: PlacementResult[],
  language?: LangCode,
): RecommendedCourse[] {
  return useMemo(() => {
    const platformResults = placement.filter((p) => p.scope === 'platform');

    let targetResult: PlacementResult | undefined;

    if (language) {
      targetResult = platformResults.find((p) => p.language === language);
    } else {
      // No language specified — pick the highest-score result
      targetResult = platformResults.reduce<PlacementResult | undefined>((best, p) =>
        !best || p.score > best.score ? p : best,
      undefined);
    }

    if (!targetResult) return [];

    const { cefrLevel } = targetResult;
    const adjacent = ADJACENT[cefrLevel] ?? [cefrLevel];

    const exact: RecommendedCourse[] = [];
    const near: RecommendedCourse[] = [];

    for (const course of courses) {
      const level = course.level as CEFR | undefined;
      if (!level) continue;
      if (level === cefrLevel) {
        exact.push({ course, isExactMatch: true });
      } else if (adjacent.includes(level)) {
        near.push({ course, isExactMatch: false });
      }
    }

    return [...exact, ...near];
  }, [courses, placement, language]);
}
