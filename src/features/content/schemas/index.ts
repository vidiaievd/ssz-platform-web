import { z } from 'zod';

export const difficultyLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const containerTypes = ['course', 'module', 'collection'] as const;

export const containerFiltersSchema = z.object({
  search: z.string().optional(),
  targetLanguage: z.string().optional(),
  level: z.enum(difficultyLevels).optional(),
  type: z.enum(containerTypes).optional(),
  cursor: z.string().optional(),
});

export type ContainerFilters = z.infer<typeof containerFiltersSchema>;
