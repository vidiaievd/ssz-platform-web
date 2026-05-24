'use server';

import { z } from 'zod';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { TutorProfile } from '../types';

const createTutorProfileSchema = z.object({
  teachingLanguages: z.array(z.string().min(1)).optional(),
  hourlyRate: z.number().positive().nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
});

export type CreateTutorProfileValues = z.infer<typeof createTutorProfileSchema>;

export async function createTutorProfileAction(
  input: CreateTutorProfileValues,
): Promise<ReturnType<typeof tryAction<TutorProfile>>> {
  return tryAction(async () => {
    const parsed = createTutorProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }

    return serverFetch<TutorProfile>({
      service: 'profile',
      path: '/api/v1/profiles/me/tutor',
      method: 'POST',
      body: parsed.data,
    });
  });
}
