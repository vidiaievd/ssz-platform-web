import type { Container } from '@/features/content/types';

export interface CourseSchoolMatch {
  schoolId: string;
  schoolName: string;
}

/**
 * A catalogue container is "also taught at a school" when content-service
 * recorded a school as its owner — that's the only signal the catalogue API
 * exposes, so dedup rides on it rather than cross-referencing every school's
 * roster of courses.
 */
export function matchAlsoTaughtAt(container: Container): CourseSchoolMatch | null {
  if (!container.ownerSchoolId || !container.ownerName) return null;
  return { schoolId: container.ownerSchoolId, schoolName: container.ownerName };
}
