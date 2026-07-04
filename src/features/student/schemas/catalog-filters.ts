import { z } from 'zod/v4';

import { difficultyLevels } from '@/features/content/schemas';

export const catalogFiltersSchema = z.object({
  /** Full-text search query */
  q:      z.string().optional(),
  /** Language of instruction code (e.g. "nb", "es") */
  lang:   z.string().optional(),
  /** Owner school name — client-side filter */
  school: z.string().optional(),
  /** Comma-separated CEFR levels, e.g. "A1,B1" */
  levels: z.string().optional(),
  /** Price category */
  price:  z.enum(['free', 'paid']).optional(),
});

export type CatalogFilters = z.infer<typeof catalogFiltersSchema>;

const VALID_LEVELS = new Set<string>(difficultyLevels);

export function parseLevels(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').filter((l) => VALID_LEVELS.has(l));
}

export function serializeLevels(levels: string[]): string | undefined {
  return levels.length > 0 ? levels.join(',') : undefined;
}
