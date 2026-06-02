'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';

import { onboardingPrefsSchema, onboardingTutorSchema } from '../schemas/onboarding';
import type { OnboardingPrefsValues, OnboardingTutorValues } from '../schemas/onboarding';
import type { CEFRLevel } from '../lib/cefr-levels';

function toValidCefrLevel(v: unknown): CEFRLevel | undefined {
  if (v === 'A1' || v === 'A2' || v === 'B1' || v === 'B2' || v === 'C1' || v === 'C2') return v;
  return undefined;
}

export async function savePrefsStepAction(input: OnboardingPrefsValues) {
  return tryAction(async () => {
    // Sanitize before schema validation: stale Zustand persist data can hold null, undefined,
    // or "" for level (e.g. from an older store schema). Keep level only when it's a valid CEFR
    // value; otherwise omit the key so Zod's .optional() accepts it cleanly.
    const sanitized = {
      nativeLanguage: input.nativeLanguage,
      targetLanguages: input.targetLanguages.map(({ code, level }) => {
        const safeLevel = toValidCefrLevel(level);
        return safeLevel != null ? { code, level: safeLevel } : { code };
      }),
    };

    const parsed = onboardingPrefsSchema.safeParse(sanitized);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    try {
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
    } catch (e) {
      // 409 means the student profile already exists (backend GET may return 404 incorrectly).
      // Treat as success so the user proceeds to dashboard.
      if (e instanceof AppError && e.code === 'conflict') return;
      throw e;
    }
  });
}

export async function skipPrefsStepAction() {
  return tryAction(async () => {
    try {
      await serverFetch({
        service: 'profile',
        path: '/profiles/me/student',
        method: 'POST',
        body: { nativeLanguage: null, targetLanguages: [] },
      });
    } catch (e) {
      if (e instanceof AppError && e.code === 'conflict') return;
      throw e;
    }
  });
}

export async function saveTutorStepAction(input: OnboardingTutorValues) {
  return tryAction(async () => {
    const parsed = onboardingTutorSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    const body = {
      teachingLanguages: parsed.data.teachingLanguages,
      hourlyRate: parsed.data.hourlyRate ?? null,
      specializations: parsed.data.specializations ?? [],
    };

    try {
      await serverFetch({ service: 'profile', path: '/profiles/me/tutor', method: 'POST', body });
    } catch (e) {
      // 409 means the tutor profile already exists — update it instead.
      if (e instanceof AppError && e.code === 'conflict') {
        await serverFetch({ service: 'profile', path: '/profiles/me/tutor', method: 'PATCH', body });
        return;
      }
      throw e;
    }
  });
}
