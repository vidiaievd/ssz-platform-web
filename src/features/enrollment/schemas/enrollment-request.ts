import { z } from 'zod';

import { difficultyLevels } from '@/features/content/schemas';

export const enrollmentRequestSchema = z.object({
  message: z.string().max(500).optional(),
  selfAssessedLevel: z.enum(difficultyLevels).optional(),
});

export type EnrollmentRequestValues = z.infer<typeof enrollmentRequestSchema>;
