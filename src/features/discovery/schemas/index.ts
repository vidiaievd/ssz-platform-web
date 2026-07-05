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

export const formatOptions = ['online', 'in-person'] as const;
export type FormatOption = (typeof formatOptions)[number];

export const discoveryQuerySchema = z.object({
  q: z.string().optional(),
  type: z.enum(schoolTypes).optional(),
  language: z.string().optional(),
  level: z.enum(difficultyLevels).optional(),
  sort: z.enum(sortOptions).optional(),
  format: z.enum(formatOptions).optional(),
  freeIntro: z.literal('true').optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>;

/** URL-driven filter state (no cursor/limit). */
export const discoverFilterSchema = discoveryQuerySchema.pick({
  q: true,
  type: true,
  language: true,
  level: true,
  sort: true,
  format: true,
  freeIntro: true,
});
export type DiscoverFilter = z.infer<typeof discoverFilterSchema>;
