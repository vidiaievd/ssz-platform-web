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
