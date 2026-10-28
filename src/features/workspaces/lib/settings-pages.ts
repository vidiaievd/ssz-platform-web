import type { SchoolRole } from '@/features/school/types';

import type { WorkspaceKind } from '../api/resolve-workspace';

export type SettingsPage =
  | 'profile'
  | 'account'
  | 'notifications'
  | 'review'
  | 'assistant'
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
 *
 * The assistant page (plan 83, step 3c) is there only when the plan carries
 * `ai.student_assist`: without it the school pays for nobody whatever is saved, so there is
 * nothing to choose. organization-service refuses the save without the key anyway.
 */
export function settingsPagesFor(
  role: SchoolRole | null,
  kind: WorkspaceKind,
  { studentAssist = false }: { studentAssist?: boolean } = {},
): SettingsPage[] {
  const recipe: SettingsPage[] = kind === 'SCHOOL' ? ['recipe'] : [];
  if (role === 'OWNER' || role === 'ADMIN') {
    const pages = studentAssist
      ? WORKSPACE_PAGES.flatMap((page): SettingsPage[] =>
          page === 'review' ? [page, 'assistant'] : [page],
        )
      : [...WORKSPACE_PAGES];
    return [...pages, ...recipe];
  }
  if (role === 'CONTENT_ADMIN') return recipe;
  return [];
}

/** The roles content-service lets change the recipe; an administrator only reads it. */
export function canEditRecipe(role: SchoolRole | null): boolean {
  return role === 'OWNER' || role === 'CONTENT_ADMIN';
}
