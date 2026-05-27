'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';

import { onboardingPrefsSchema, onboardingTutorSchema } from '../schemas/onboarding';
import type { OnboardingPrefsValues, OnboardingTutorValues } from '../schemas/onboarding';

export async function savePrefsStepAction(input: OnboardingPrefsValues) {
  return tryAction(async () => {
    const parsed = onboardingPrefsSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }

    await serverFetch({
      service: 'profile',
      path: '/profiles/me/student',
      method: 'POST',
      body: {
        nativeLanguage: parsed.data.nativeLanguage,
        targetLanguages: parsed.data.targetLanguages.map((t) =>
          t.level ? { code: t.code, level: t.level } : { code: t.code },
        ),
      },
    });
  });
}

export async function skipPrefsStepAction() {
  return tryAction(async () => {
    await serverFetch({
      service: 'profile',
      path: '/profiles/me/student',
      method: 'POST',
      body: { nativeLanguage: null, targetLanguages: [] },
    });
  });
}

export async function saveTutorStepAction(input: OnboardingTutorValues) {
  return tryAction(async () => {
    const parsed = onboardingTutorSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }

    await serverFetch({
      service: 'profile',
      path: '/profiles/me/tutor',
      method: 'POST',
      body: {
        teachingLanguages: parsed.data.teachingLanguages,
        hourlyRate: parsed.data.hourlyRate ?? null,
        specializations: parsed.data.specializations ?? [],
      },
    });
  });
}

export async function skipTutorStepAction() {
  return tryAction(async () => {
    await serverFetch({
      service: 'profile',
      path: '/profiles/me/tutor',
      method: 'POST',
      body: { teachingLanguages: [], hourlyRate: null, specializations: [] },
    });
  });
}
