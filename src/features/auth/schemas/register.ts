import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'At least one uppercase letter')
  .regex(/[a-z]/, 'At least one lowercase letter')
  .regex(/[0-9]/, 'At least one number')
  .regex(/[^A-Za-z0-9]/, 'At least one special character');

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: passwordSchema,
    passwordConfirm: z.string(),
    acceptedTerms: z.literal(true, { message: 'You must accept the terms' }),
    role: z.enum(['school_admin', 'teacher', 'tutor', 'student']).optional(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Passwords do not match',
    path: ['passwordConfirm'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
