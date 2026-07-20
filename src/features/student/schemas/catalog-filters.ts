import { z } from 'zod/v4';

import { difficultyLevels } from '@/features/content/schemas';

export const catalogFiltersSchema = z.object({
  /** Full-text search query */
  q:      z.string().optional(),
  /** Language of instruction code (e.g. "nb", "es") */
  lang:   z.string().optional(),
  /** Comma-separated CEFR levels, e.g. "A1,B1" */
  levels: z.string().optional(),
  /** Access tab — how the course can be reached. */
  tab:    z.enum(['all', 'free', 'paid', 'school']).optional(),
});

export type CatalogFilters = z.infer<typeof catalogFiltersSchema>;
export type CatalogTab = NonNullable<CatalogFilters['tab']>;

export const CATALOG_TABS: CatalogTab[] = ['all', 'free', 'paid', 'school'];

const VALID_LEVELS = new Set<string>(difficultyLevels);

export function parseLevels(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').filter((l) => VALID_LEVELS.has(l));
}

export function serializeLevels(levels: string[]): string | undefined {
  return levels.length > 0 ? levels.join(',') : undefined;
}
