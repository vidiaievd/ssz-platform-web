import type { WorkspaceKind } from '../api/resolve-workspace';

/**
 * A workspace, as much of it as the caller happens to hold.
 *
 * Most call sites have only the segment they were routed with, and that is deliberately
 * enough: what a workspace address looks like is this module's business, not theirs.
 */
export type WorkspaceRef = string | { id: string; slug?: string | null; kind?: WorkspaceKind };

/**
 * The address of a screen inside one workspace.
 *
 * `wsHref(ws, 'groups')`, `wsHref(ws, `content/${id}`)`, `wsHref(ws)` for its front page.
 * Every staff screen lives here now — a school's and a private tutor's alike, which is the
 * whole point: the same screen, one address, and which of the two is drawn follows from
 * the workspace's kind rather than from the URL (plan 61).
 *
 * The result carries no locale: links in the app are relative to it, and the few places
 * that need an absolute path prefix it themselves.
 */
export function wsHref(ws: WorkspaceRef, path = ''): string {
  const segment = typeof ws === 'string' ? ws : ws.id;
  const tail = path.replace(/^\/+/, '');

  return tail ? `/w/${segment}/${tail}` : `/w/${segment}`;
}
