'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';

import { onboardingPrefsSchema } from '../schemas/onboarding';
import type { OnboardingPrefsValues } from '../schemas/onboarding';

export async function savePrefsStepAction(input: OnboardingPrefsValues) {
  return tryAction(async () => {
    const parsed = onboardingPrefsSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }

    await serverFetch({
      service: 'profile',
      path: '/api/v1/profiles/me/student',
      method: 'POST',
      body: {
        nativeLanguage: parsed.data.nativeLanguage,
        targetLanguages: parsed.data.targetLanguages.map((t) => t.code),
      },
    });
  });
}

export async function skipPrefsStepAction() {
  return tryAction(async () => {
    await serverFetch({
      service: 'profile',
      path: '/api/v1/profiles/me/student',
      method: 'POST',
      body: { nativeLanguage: null, targetLanguages: [] },
    });
  });
}
