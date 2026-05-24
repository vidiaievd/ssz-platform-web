'use server';

import { z } from 'zod';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import { LOCALES } from '@/lib/i18n/config';

export const onboardingProfileSchema = z.object({
  displayName: z.string().trim().min(2, 'Display name must be at least 2 characters').max(40, 'Display name must be 40 characters or fewer'),
  firstName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
  timezone: z.string().min(1, 'Timezone is required'),
  uiLocale: z.enum(LOCALES),
  bio: z.string().max(200, 'Bio must be 200 characters or fewer').optional(),
});

export type OnboardingProfileValues = z.infer<typeof onboardingProfileSchema>;

export async function saveProfileStepAction(input: OnboardingProfileValues) {
  return tryAction(async () => {
    const parsed = onboardingProfileSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }

    await serverFetch({
      service: 'profile',
      path: '/api/v1/profiles/me',
      method: 'PATCH',
      body: {
        displayName: parsed.data.displayName,
        timezone: parsed.data.timezone,
        uiLocale: parsed.data.uiLocale,
        bio: parsed.data.bio || null,
      },
    });
  });
}
