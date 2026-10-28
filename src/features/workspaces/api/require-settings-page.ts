import 'server-only';

import { notFound } from 'next/navigation';

import { can } from '@/features/entitlements';
import { getEntitlements } from '@/features/entitlements/api/get-entitlements';

import { settingsPagesFor, type SettingsPage } from '../lib/settings-pages';
import { resolveWorkspace, type ResolvedWorkspace } from './resolve-workspace';

/**
 * The workspace, if the caller may open this settings page; a 404 otherwise.
 *
 * Each page asks for itself: the layout cannot see which page it wraps, and a content
 * admin let into settings for the recipe must not reach the rest by typing the address.
 */
export async function requireSettingsPage(
  workspaceId: string,
  page: SettingsPage,
): Promise<ResolvedWorkspace> {
  const workspace = await resolveWorkspace(workspaceId);
  if (!workspace) notFound();
  const pages = settingsPagesFor(
    workspace.myRole,
    workspace.kind,
    await settingsFeaturesOf(workspace),
  );
  if (!pages.includes(page)) notFound();
  return workspace;
}

/**
 * The plan keys that add a settings page. The workspace layout has read the same
 * entitlements already, so this is a cache hit, not a second request.
 */
export async function settingsFeaturesOf(
  workspace: ResolvedWorkspace,
): Promise<{ studentAssist: boolean }> {
  const entitlements = await getEntitlements(workspace.id);
  return { studentAssist: can(entitlements, 'ai.student_assist') };
}
