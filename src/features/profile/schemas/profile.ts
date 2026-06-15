import { z } from 'zod';

import { LOCALES } from '@/lib/i18n/config';

const localeEnum = z.enum(LOCALES);

// Lazily evaluated — Intl.supportedValuesOf is available in Node 18+ and all modern browsers.
const IANA_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));

export const profileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  handle: z.string().nullable(),
  displayName: z.string().min(1).max(100),
  bio: z.string().max(500).nullable(),
  avatarUrl: z.string().url().nullable(),
  uiLocale: localeEnum,
  instructionLocales: z.array(localeEnum),
  timezone: z.string().refine((tz) => IANA_TIMEZONES.has(tz), { message: 'Invalid IANA timezone' }),
  contactEmail: z.string().email().nullable(),
  contactPhone: z.string().max(30).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProfileData = z.infer<typeof profileSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
  // URL-safe slug: lowercase letters, digits, hyphens; 3–32 chars
  handle: z
    .string()
    .regex(/^[a-z0-9-]{3,32}$/, 'Handle must be 3–32 lowercase letters, digits or hyphens')
    .nullable()
    .optional(),
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name is too long'),
  bio: z.string().max(500, 'Bio must be 500 characters or fewer').nullable().optional(),
  uiLocale: localeEnum,
  instructionLocales: z.array(localeEnum).optional(),
  timezone: z.string().refine((tz) => IANA_TIMEZONES.has(tz), { message: 'Invalid timezone' }),
  contactEmail: z.string().email('Invalid email').nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const profileSettingsSchema = updateProfileSchema.extend({
  hourlyRate: z.number().min(0).nullable().optional(),
  currency: z.string().max(3).nullable().optional(),
});

export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;

const PHONE_REGEX = /^\+?[\d\s\-().]{7,25}$/;

export function createProfileSettingsSchema(messages: {
  invalidEmail: string;
  invalidPhone: string;
}) {
  return updateProfileSchema
    .omit({ contactEmail: true, contactPhone: true })
    .extend({
      contactEmail: z.string().email(messages.invalidEmail).nullable().optional(),
      contactPhone: z
        .string()
        .regex(PHONE_REGEX, messages.invalidPhone)
        .nullable()
        .optional(),
      hourlyRate: z.number().min(0).nullable().optional(),
      currency: z.string().max(3).nullable().optional(),
    });
}
