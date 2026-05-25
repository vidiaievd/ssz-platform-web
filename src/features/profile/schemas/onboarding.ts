import { z } from 'zod';

import { LOCALES } from '@/lib/i18n/config';
import { CEFR_LEVELS } from '../stores/onboarding-store';

export const onboardingProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(40, 'Display name must be 40 characters or fewer'),
  firstName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
  timezone: z.string().min(1, 'Timezone is required'),
  uiLocale: z.enum(LOCALES),
  bio: z.string().max(200, 'Bio must be 200 characters or fewer').optional(),
});

export type OnboardingProfileValues = z.infer<typeof onboardingProfileSchema>;

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

export const createStudentProfileSchema = z.object({
  nativeLanguage: z.string().min(1).nullable().optional(),
  targetLanguages: z.array(z.string().min(1)).optional(),
});

export type CreateStudentProfileValues = z.infer<typeof createStudentProfileSchema>;

export const createTutorProfileSchema = z.object({
  teachingLanguages: z.array(z.string().min(1)).optional(),
  hourlyRate: z.number().positive().nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
});

export type CreateTutorProfileValues = z.infer<typeof createTutorProfileSchema>;
