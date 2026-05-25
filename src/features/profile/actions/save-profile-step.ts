'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';

import { onboardingProfileSchema } from '../schemas/onboarding';
import type { OnboardingProfileValues } from '../schemas/onboarding';

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
