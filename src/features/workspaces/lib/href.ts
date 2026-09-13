import type { WorkspaceKind } from '../api/resolve-workspace';

/**
 * The sections that live at `/w/<workspaceId>/…` already.
 *
 * The move off `/school/<slug>/…` arrives section by section (plan 61), so this is a set
 * and not a switch: a section that has not moved keeps its old address, and every link to
 * it keeps working, whoever built the link. Add a section's first path segment here on the
 * commit that moves its routes.
 *
 * Delete this, and the branch in `buildHref`, once the last section has moved and the old
 * tree is nothing but redirects.
 */
export const WORKSPACE_ROUTES: ReadonlySet<string> = new Set(['content']);

/**
 * A workspace, as much of it as the caller happens to hold.
 *
 * Most call sites have only the segment they were routed with — a school's slug today, a
 * workspace id afterwards — and that is deliberately enough: which of the two is the
 * canonical address is this module's business, not theirs.
 */
export type WorkspaceRef =
  | string
  | { id: string; slug?: string | null; kind?: WorkspaceKind };

/**
 * The address of a screen inside one workspace.
 *
 * `wsHref(school, 'groups')`, `wsHref(ws, `content/${id}`)`, `wsHref(ws)` for its root.
 * The result carries no locale: links in the app are relative to it, and the handful of
 * places that need an absolute path prefix this themselves.
 */
export function wsHref(ws: WorkspaceRef, path = ''): string {
  return buildHref(hasMoved(path), ws, path);
}

/** Which section a path belongs to — its first segment, before any `/`, `?` or `#`. */
function hasMoved(path: string): boolean {
  const section = path.replace(/^\/+/, '').split(/[/?#]/, 1)[0] ?? '';
  return WORKSPACE_ROUTES.has(section);
}

/**
 * The two addresses side by side, so that the one that does not exist yet is still
 * something a test can hold. `wsHref` is this with the flag already applied.
 */
export function buildHref(byWorkspace: boolean, ws: WorkspaceRef, path = ''): string {
  const segment = typeof ws === 'string' ? ws : byWorkspace ? ws.id : (ws.slug ?? ws.id);

  const root = byWorkspace ? `/w/${segment}` : `/school/${segment}`;
  const tail = path.replace(/^\/+/, '');

  return tail ? `${root}/${tail}` : root;
}
