import type { WorkspaceKind } from '../api/resolve-workspace';

/**
 * Whether workspace screens are addressed by workspace yet.
 *
 * The move from `/school/<slug>/…` to `/w/<id>/…` touches every link in the staff
 * surfaces at once, but the routes themselves arrive section by section (plan 61). While
 * this is `false` the helper keeps producing the addresses that exist today, so the links
 * can all be rewritten in one mechanical pass long before anything moves.
 *
 * Delete it, and the branch below, once the last section has moved.
 */
export const WORKSPACE_ROUTES = false;

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
  return buildHref(WORKSPACE_ROUTES, ws, path);
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
