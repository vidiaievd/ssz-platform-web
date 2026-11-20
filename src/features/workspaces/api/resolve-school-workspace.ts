import 'server-only';

import { resolveWorkspace, type ResolvedWorkspace } from './resolve-workspace';

/**
 * The signed-in person's school behind a workspace address (`/w/<id or slug>/…`), or null when
 * it is not theirs or not a school (a tutor's SOLO space has no enrollment).
 *
 * The enrollment screens used to look the school up through the public page
 * (`schools/public/<slug>`), which knows slugs only and active schools only — so on the uuid
 * address every link uses, and in a suspended or closed school, they lost the school (plan 90,
 * live check, session 12). The workspace lookup takes either and any lifecycle status.
 */
export async function resolveSchoolWorkspace(idOrSlug: string): Promise<ResolvedWorkspace | null> {
  const workspace = await resolveWorkspace(idOrSlug);
  return workspace?.kind === 'SCHOOL' ? workspace : null;
}
