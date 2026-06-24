import { z } from 'zod';

export const enrollmentRequestSchema = z.object({
  language: z.string().regex(/^[a-z]{2}$/).optional(),
  selfReportedLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
});

export type EnrollmentRequestValues = z.infer<typeof enrollmentRequestSchema>;
