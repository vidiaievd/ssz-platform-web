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
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    await serverFetch({
      service: 'profile',
      path: '/profiles/me',
      method: 'PATCH',
      body: {
        displayName: parsed.data.displayName,
        timezone: parsed.data.timezone,
        // Backend returns the field as "locale" in GET responses, so we send both.
        // TODO: reconcile once backend confirms the canonical PATCH field name.
        locale: parsed.data.uiLocale,
        uiLocale: parsed.data.uiLocale,
        bio: parsed.data.bio || null,
      },
    });
  });
}
