import { z } from 'zod';

export const onboardingSettingsSchema = z.object({
  placement: z.object({
    mode: z.enum(['platform', 'school', 'none']),
    reusePlatformResult: z.boolean(),
    maxResultAgeDays: z.number().int().positive().optional(),
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

export type OnboardingSettingsInput = z.infer<typeof onboardingSettingsSchema>;
