import { z } from 'zod';

import { difficultyLevels } from '@/features/content/schemas';

export const schoolTypes = ['school', 'tutor'] as const;

export const sortOptions = ['recommended', 'rating', 'price-asc', 'students', 'name'] as const;
export type SortOption = (typeof sortOptions)[number];

export const schoolFiltersSchema = z.object({
  search: z.string().optional(),
  language: z.string().optional(),
  level: z.enum(difficultyLevels).optional(),
  type: z.enum(schoolTypes).optional(),
});

export type SchoolFilters = z.infer<typeof schoolFiltersSchema>;

export const discoveryQuerySchema = z.object({
  q: z.string().optional(),
  type: z.enum(schoolTypes).optional(),
  sort: z.enum(sortOptions).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>;
