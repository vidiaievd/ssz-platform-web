'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { StudentProfile } from '../types';

import { createStudentProfileSchema } from '../schemas/onboarding';
import type { CreateStudentProfileValues } from '../schemas/onboarding';

export async function createStudentProfileAction(
  input: CreateStudentProfileValues,
): Promise<ReturnType<typeof tryAction<StudentProfile>>> {
  return tryAction(async () => {
    const parsed = createStudentProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }

    return serverFetch<StudentProfile>({
      service: 'profile',
      path: '/api/v1/profiles/me/student',
      method: 'POST',
      body: parsed.data,
    });
  });
}
