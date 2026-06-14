import type { SchoolRole } from '@/features/school/types';

export type SchoolPermissions = {
  role: SchoolRole;
  capabilities: string[];
};

/**
 * Returns true if the user has one of the listed roles,
 * or if they are a MANAGER with the required capability.
 */
export function hasCapabilityOrRole(
  permissions: SchoolPermissions,
  capability: string,
  roles: SchoolRole[],
): boolean {
  if (roles.includes(permissions.role)) return true;
  if (permissions.role === 'MANAGER') return permissions.capabilities.includes(capability);
  return false;
}
