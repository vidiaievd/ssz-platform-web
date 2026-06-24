import { z } from 'zod';

export const enrollmentRequestSchema = z.object({
  language: z.string().regex(/^[a-z]{2}$/).optional(),
});

export type EnrollmentRequestValues = z.infer<typeof enrollmentRequestSchema>;
