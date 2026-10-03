import 'server-only';

import { notFound } from 'next/navigation';

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
  if (!workspace || !settingsPagesFor(workspace.myRole, workspace.kind).includes(page)) notFound();
  return workspace;
}
