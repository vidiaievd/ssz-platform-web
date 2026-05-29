'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { TutorProfile } from '../types';

import { createTutorProfileSchema } from '../schemas/onboarding';
import type { CreateTutorProfileValues } from '../schemas/onboarding';

export async function createTutorProfileAction(
  input: CreateTutorProfileValues,
): Promise<ReturnType<typeof tryAction<TutorProfile>>> {
  return tryAction(async () => {
    const parsed = createTutorProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    return serverFetch<TutorProfile>({
      service: 'profile',
      path: '/profiles/me/tutor',
      method: 'POST',
      body: parsed.data,
    });
  });
}
