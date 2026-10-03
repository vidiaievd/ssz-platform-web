import type { SchoolRole } from '@/features/school/types';

import type { WorkspaceKind } from '../api/resolve-workspace';

export type SettingsPage =
  | 'profile'
  | 'account'
  | 'notifications'
  | 'review'
  | 'progress'
  | 'recipe';

const WORKSPACE_PAGES: readonly SettingsPage[] = [
  'profile',
  'account',
  'notifications',
  'review',
  'progress',
];

/**
 * Which settings pages a role reaches in a workspace, in nav order — plan 65, Q1 and Q2.
 *
 * Owners and administrators run the workspace and see all of it. A content admin sets the
 * teaching standard and nothing else, so the lesson recipe is the one page they reach.
 *
 * The recipe is a school's page only: a tutor's courses are not tied to their SOLO
 * workspace, inherit nothing from it, and a recipe saved there would check no lesson.
 */
export function settingsPagesFor(role: SchoolRole | null, kind: WorkspaceKind): SettingsPage[] {
  const recipe: SettingsPage[] = kind === 'SCHOOL' ? ['recipe'] : [];
  if (role === 'OWNER' || role === 'ADMIN') return [...WORKSPACE_PAGES, ...recipe];
  if (role === 'CONTENT_ADMIN') return recipe;
  return [];
}

/** The roles content-service lets change the recipe; an administrator only reads it. */
export function canEditRecipe(role: SchoolRole | null): boolean {
  return role === 'OWNER' || role === 'CONTENT_ADMIN';
}
