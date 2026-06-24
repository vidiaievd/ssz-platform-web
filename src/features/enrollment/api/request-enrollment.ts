'use server';

import { AppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';
import type { EnrollmentRequestValues } from '../schemas/enrollment-request';
import { enrollmentRequestSchema } from '../schemas/enrollment-request';
import type { Membership, MembershipStatus } from '../types';

type CreatedMembership = {
  id: string;
  schoolId: string;
  status: MembershipStatus;
  source: Membership['source'];
};

export async function requestEnrollmentAction(
  schoolId: string,
  input: EnrollmentRequestValues,
): Promise<ReturnType<typeof tryAction<CreatedMembership>>> {
  return tryAction(async () => {
    const parsed = enrollmentRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    return serverFetch<CreatedMembership>({
      service: 'organization',
      path: `/schools/${schoolId}/memberships`,
      method: 'POST',
      body: {
        source: 'public-apply',
        language: parsed.data.language,
        selfReportedLevel: parsed.data.selfReportedLevel,
      },
    });
  });
}
