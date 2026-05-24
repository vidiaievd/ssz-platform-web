'use server';

import { z } from 'zod';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import { CEFR_LEVELS } from '../stores/onboarding-store';

export const onboardingPrefsSchema = z.object({
  nativeLanguage: z.string().min(1, 'Native language is required'),
  targetLanguages: z
    .array(
      z.object({
        code: z.string().min(2),
        level: z.enum(CEFR_LEVELS),
      }),
    )
    .max(10)
    .refine((langs) => new Set(langs.map((l) => l.code)).size === langs.length, {
      message: 'Duplicate languages are not allowed',
    }),
});

export type OnboardingPrefsValues = z.infer<typeof onboardingPrefsSchema>;

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
