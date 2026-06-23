import type { ShareRole } from '@/features/content/types';

/** Backend permission levels (content-service SharePermission). EDIT is the co-author role. */
export type SharePermission = 'READ' | 'READ_AND_REVIEW' | 'EDIT';

const ROLE_TO_PERMISSION: Record<ShareRole, SharePermission> = {
  co_author: 'EDIT',
  viewer: 'READ',
};

export function shareRoleToPermission(role: ShareRole): SharePermission {
  return ROLE_TO_PERMISSION[role];
}

export function permissionToShareRole(permission: string): ShareRole {
  return permission === 'EDIT' ? 'co_author' : 'viewer';
}

/** Maps a TaggableEntityType value (e.g. 'container') to the URL slug content-service expects
 * for the list-shares-for-entity route (e.g. 'containers'). */
const ENTITY_TYPE_TO_URL_SLUG: Record<string, string> = {
  container: 'containers',
  lesson: 'lessons',
  vocabulary_list: 'vocabulary-lists',
  grammar_rule: 'grammar-rules',
  exercise: 'exercises',
};

export function entityTypeToUrlSlug(entityType: string): string {
  return ENTITY_TYPE_TO_URL_SLUG[entityType] ?? entityType;
}
