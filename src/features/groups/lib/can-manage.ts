import type { SchoolRole } from '@/features/school/types';

/**
 * Single source of truth for "can this role mutate groups" — shared by the
 * groups list and group detail pages.
 *
 * MANAGER capabilities are not fully specced (see spec Q5); defaulting to
 * include MANAGER alongside OWNER/ADMIN until that's confirmed.
 * TODO confirm MANAGER
 */
export function canManageGroups(role: SchoolRole | null): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER';
}
