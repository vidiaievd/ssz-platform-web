import 'server-only';

import { getSchoolByRef } from './get-school-by-ref';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The organization-service group routes require a school UUID (ParseUUIDPipe),
 * but the web app's URLs and the groups feature pass around the school slug.
 * Resolve whichever form was given to the real UUID before calling the backend.
 */
export async function resolveSchoolId(idOrSlug: string): Promise<string | null> {
  if (UUID_RE.test(idOrSlug)) return idOrSlug;
  const school = await getSchoolByRef(idOrSlug);
  return school?.id ?? null;
}

export { UUID_RE };
