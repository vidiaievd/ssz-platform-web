'use server';

import { AppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';
import { updateProfileSchema, type UpdateProfileInput } from '../schemas';
import type { Profile } from '../types';

export async function updateProfileAction(input: UpdateProfileInput) {
  return tryAction(async () => {
    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }

    return await serverFetch<Profile>({
      service: 'profile',
      path: '/profiles/me',
      method: 'PATCH',
      body: parsed.data,
    });
  });
}
