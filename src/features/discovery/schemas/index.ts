import { z } from 'zod';

import { difficultyLevels } from '@/features/content/schemas';

export const schoolTypes = ['school', 'tutor'] as const;

export const schoolFiltersSchema = z.object({
  search: z.string().optional(),
  language: z.string().optional(),
  level: z.enum(difficultyLevels).optional(),
  type: z.enum(schoolTypes).optional(),
});

export type SchoolFilters = z.infer<typeof schoolFiltersSchema>;
