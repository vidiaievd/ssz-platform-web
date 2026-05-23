'use server';

import { AppError } from '@/lib/errors';
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
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }

    // Stub response until the Enrollment service is available.
    // Replace with serverFetch({ service: 'enrollment', path: '/api/v1/requests', method: 'POST', body: { schoolId, ...parsed.data } })
    const stub: EnrollmentRequest = {
      id: crypto.randomUUID(),
      schoolId,
      schoolName: 'School',
      schoolType: 'school',
      message: parsed.data.message,
      selfAssessedLevel: parsed.data.selfAssessedLevel,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return stub;
  });
}
