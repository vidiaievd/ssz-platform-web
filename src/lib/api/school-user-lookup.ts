import { serverFetch } from '@/lib/api/server-fetcher';

/**
 * organization's `GET schools/:id/users/lookup?email=` (plan 90, session 16 remark 4): whether an
 * address has an account, asked by the school's owner / admin / manager / teacher while adding
 * someone. Limited per asker (429 → AppError `rate_limited`); no role list in the answer. A missing
 * account is `found: false`, never an error — an error means "could not tell", and must not be read
 * as a new user (that sends a registration letter to someone who already has an account).
 */
export type SchoolUserLookup =
  | { found: false }
  | { found: true; userId: string; displayName: string | null; isStudent: boolean; isTeacher: boolean };

export function lookupSchoolUser(schoolId: string, email: string): Promise<SchoolUserLookup> {
  return serverFetch<SchoolUserLookup>({
    service: 'organization',
    path: `/schools/${schoolId}/users/lookup`,
    query: { email },
  });
}
