import { z } from 'zod';
import { passwordSchema } from '@/features/auth/schemas';

export const studentRegisterSchema = z
  .object({
    email: z.string().email(),
    password: passwordSchema,
    passwordConfirm: z.string(),
    dateOfBirth: z.string().optional(),
    acceptedTerms: z.literal(true, { message: 'You must accept the terms' }),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Passwords do not match',
    path: ['passwordConfirm'],
  });

export type StudentRegisterInput = z.infer<typeof studentRegisterSchema>;
