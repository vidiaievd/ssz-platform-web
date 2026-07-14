import type { StudentSchool } from '@/features/student/types';

/** Discover entry is shown only when the student has no active memberships. */
export function showFindSchoolEntry(schools: StudentSchool[]): boolean {
  return !schools.some((s) => s.status === 'active');
}
