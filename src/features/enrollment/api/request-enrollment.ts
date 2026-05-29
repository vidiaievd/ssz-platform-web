'use server';

import { AppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';
import type { EnrollmentRequestValues } from '../schemas/enrollment-request';
import { enrollmentRequestSchema } from '../schemas/enrollment-request';
import type { EnrollmentRequest } from '../types';

export async function requestEnrollmentAction(
  schoolId: string,
  input: EnrollmentRequestValues,
): Promise<ReturnType<typeof tryAction<EnrollmentRequest>>> {
  return tryAction(async () => {
    const parsed = enrollmentRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    const data = await serverFetch<EnrollmentRequest>({
      service: 'enrollment',
      path: '/requests',
      method: 'POST',
      body: { schoolId, ...parsed.data },
    });

    return data;
  });
}
