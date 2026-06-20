// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRecommendedCourses } from './use-recommended-courses';
import type { PlacementResult } from '@/features/enrollment/types';
import type { Container } from '@/features/content/types';

const makeCourse = (id: string, level: string): Container =>
  ({
    id,
    slug: id,
    title: id,
    difficultyLevel: level,
    containerType: 'course',
    visibility: 'public',
    accessTier: 'public_free',
    currentPublishedVersionId: 'v1',
    ownerUserId: 'u1',
  }) as unknown as Container;

const b1Result: PlacementResult = {
  language: 'nb',
  cefrLevel: 'B1',
  score: 55,
  takenAt: '2026-06-01',
  scope: 'platform',
  sourceLabel: 'platform',
};

const a1Result: PlacementResult = {
  language: 'en',
  cefrLevel: 'A1',
  score: 10,
  takenAt: '2026-06-01',
  scope: 'platform',
  sourceLabel: 'platform',
};

const COURSES: Container[] = [
  makeCourse('a2-course', 'A2'),
  makeCourse('b1-course', 'B1'),
  makeCourse('b2-course', 'B2'),
  makeCourse('c1-course', 'C1'),
  makeCourse('unlevel', undefined as unknown as string),
];

describe('useRecommendedCourses', () => {
  it('returns exact match first, then adjacent', () => {
    const { result } = renderHook(() =>
      useRecommendedCourses(COURSES, [b1Result], 'nb'),
    );
    const ids = result.current.map((r) => r.course.id);
    expect(ids[0]).toBe('b1-course'); // exact
    expect(ids).toContain('a2-course'); // adjacent
    expect(ids).toContain('b2-course'); // adjacent
    expect(ids).not.toContain('c1-course'); // too far
    expect(ids).not.toContain('unlevel'); // no level
  });

  it('marks exact vs non-exact correctly', () => {
    const { result } = renderHook(() =>
      useRecommendedCourses(COURSES, [b1Result], 'nb'),
    );
    const exact = result.current.filter((r) => r.isExactMatch);
    const near = result.current.filter((r) => !r.isExactMatch);
    expect(exact.map((r) => r.course.id)).toEqual(['b1-course']);
    expect(near.map((r) => r.course.id)).toContain('a2-course');
  });

  it('returns empty when no placement for the requested language', () => {
    const { result } = renderHook(() =>
      useRecommendedCourses(COURSES, [b1Result], 'en'),
    );
    expect(result.current).toHaveLength(0);
  });

  it('picks highest-score result when language is omitted', () => {
    // b1Result.score=55 > a1Result.score=10 → should use nb/B1
    const { result } = renderHook(() =>
      useRecommendedCourses(COURSES, [b1Result, a1Result]),
    );
    const ids = result.current.map((r) => r.course.id);
    expect(ids).toContain('b1-course');
  });

  it('returns empty when placement array is empty', () => {
    const { result } = renderHook(() =>
      useRecommendedCourses(COURSES, []),
    );
    expect(result.current).toHaveLength(0);
  });

  it('ignores membership-scoped placement results', () => {
    const membershipResult: PlacementResult = { ...b1Result, scope: 'membership' };
    const { result } = renderHook(() =>
      useRecommendedCourses(COURSES, [membershipResult], 'nb'),
    );
    expect(result.current).toHaveLength(0);
  });
});
