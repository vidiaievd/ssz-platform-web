import type { SchoolLifecycleStatus } from '../types';

export interface ObsoleteCourseFacts {
  maintenanceSource?: 'author' | 'school' | null;
  schoolStatus?: SchoolLifecycleStatus;
}

/**
 * An obsolete course a learner can only look back on (plan 90, Q11): the school's purge kept it
 * (`maintenanceSource: school`), or its school is closed — the engine refuses a start. A course its
 * author retired is still studied by those already on it (a suspension has its own banner).
 */
export function isObsoleteHistoryOnly(course: ObsoleteCourseFacts): boolean {
  return (
    course.maintenanceSource === 'school' ||
    course.schoolStatus === 'closed' ||
    course.schoolStatus === 'purged'
  );
}
