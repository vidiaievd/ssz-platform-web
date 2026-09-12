import type { SchoolRole } from '@/features/school/types';

/**
 * Single source of truth for "can this role mutate groups" — shared by the
 * groups list and group detail pages.
 *
 * MANAGER is intentionally included: confirmed in project spec, same level as ADMIN
 * for group operations but without billing/ownership access.
 */
export function canManageGroups(role: SchoolRole | null): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER';
}

/**
 * Whether this role may see named learners' results — the heatmap of screen B, and the
 * link from it into one learner's profile.
 *
 * `SCHEDULER` is excluded on purpose (BEHAVIOR §Roles): the schedule is built from hours
 * and rooms, and nothing in it needs to know which student is struggling. `CONTENT_ADMIN`
 * is excluded for the same reason from the other side — they answer for the course, not
 * for the class.
 */
export function canSeePersonalResults(role: SchoolRole | null): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER' || role === 'TEACHER';
}
