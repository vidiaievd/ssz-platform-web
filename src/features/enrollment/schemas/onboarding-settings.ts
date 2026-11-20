import { z } from 'zod';

export const onboardingSettingsSchema = z.object({
  placement: z.object({
    mode: z.enum(['platform', 'school', 'none']),
    reusePlatformResult: z.boolean(),
    // An empty number input reads as NaN (valueAsNumber) and a never-set value comes back as null:
    // both mean "no limit", not an invalid form that silently refuses to submit.
    maxResultAgeDays: z.preprocess(
      (v) => (v === null || v === '' || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
      z.number().int().positive().optional(),
    ),
  }),
  interview: z.object({
    required: z.boolean(),
    autoPlaceByScore: z.boolean(),
  }),
  availability: z.object({
    collect: z.boolean(),
  }),
  ageBands: z.object({
    values: z.array(z.enum(['kids', 'teens', 'adults'])),
    collect: z.boolean(),
  }),
  approval: z.object({
    mode: z.enum(['auto', 'manual']),
  }),
});

/** What the form holds before validation (the max age may still be empty). */
export type OnboardingSettingsFormValues = z.input<typeof onboardingSettingsSchema>;
export type OnboardingSettingsInput = z.infer<typeof onboardingSettingsSchema>;
