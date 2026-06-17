import 'server-only';

import { getMySchools } from './get-my-schools';
import type { SchoolRole } from '../types';

/**
 * Returns the current user's role in the given school (by slug or id).
 * Returns null if the school is not found or the user has no role.
 * Uses the cached school list — no extra round-trip when called after getMySchools.
 */
export async function getMySchoolRole(schoolSlug: string): Promise<SchoolRole | null> {
  const schools = await getMySchools();
  const school = schools.find((s) => s.slug === schoolSlug || s.id === schoolSlug);
  return school?.myRole ?? null;
}
