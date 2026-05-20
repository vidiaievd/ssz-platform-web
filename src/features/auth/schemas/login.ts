import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Second step — submitted to /auth/mfa/challenge
export const mfaChallengeSchema = z.object({
  mfaChallengeToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'Must be a 6-digit code'),
});

export type MfaChallengeInput = z.infer<typeof mfaChallengeSchema>;
