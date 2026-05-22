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
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name is too long'),
  bio: z.string().max(500, 'Bio must be 500 characters or fewer').nullable().optional(),
  uiLocale: localeEnum,
  instructionLocales: z.array(localeEnum).optional(),
  timezone: z.string().refine((tz) => IANA_TIMEZONES.has(tz), { message: 'Invalid timezone' }),
  contactEmail: z.string().email('Invalid email').nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
