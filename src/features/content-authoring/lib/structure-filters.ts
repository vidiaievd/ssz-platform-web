import type { MaterialKind } from '@/lib/content/lesson-types';
import type { CurriculumTreeItemNode } from '@/features/content/types';

import { getMaterialKind } from './material-kind';

/** The four groups the toolbar filters by — the spec's block-type families. */
export type BlockTypeGroup = 'vocab' | 'text' | 'grammar' | 'exercises';
export type BlockTypeFilter = 'all' | BlockTypeGroup;

/**
 * Three-state lifecycle of a single block, as an author reads it.
 *
 * The domain has no per-item publish state — publication belongs to the
 * container version. What it does have is whether the *published* version
 * places this row (`isLive`) and what publishing would change about it
 * (`pendingChange`), which is enough to answer the question the filter asks.
 */
export type BlockState = 'published' | 'edited' | 'draft';
export type BlockStateFilter = 'all' | BlockState;

export interface StructureFilters {
  query: string;
  type: BlockTypeFilter;
  state: BlockStateFilter;
}

export const EMPTY_FILTERS: StructureFilters = { query: '', type: 'all', state: 'all' };

/** Every block a module holds, across its sections and its ungrouped bucket. */
export function moduleItems(module: {
  sections: { items: CurriculumTreeItemNode[] }[];
  ungroupedItems: CurriculumTreeItemNode[];
}): CurriculumTreeItemNode[] {
  return [...module.sections.flatMap((s) => s.items), ...module.ungroupedItems];
}

/** Whether anything is being filtered at all — drives the "hide empty sections" rule. */
export function isFiltering(filters: StructureFilters): boolean {
  return filters.query.trim() !== '' || filters.type !== 'all' || filters.state !== 'all';
}

/** Reading and listening are one family to an author, however they are stored. */
export function materialGroup(kind: MaterialKind): BlockTypeGroup {
  switch (kind) {
    case 'vocab':
      return 'vocab';
    case 'grammar':
      return 'grammar';
    case 'exercise':
      return 'exercises';
    default:
      return 'text';
  }
}

export function blockState(item: CurriculumTreeItemNode): BlockState {
  // `null` means the owning container has never been published, so nothing in
  // it can be live yet.
  if (item.isLive === null) return 'draft';
  if (!item.isLive || item.pendingChange !== null) return 'edited';
  return 'published';
}

/**
 * @param typeLabel the block's localised material-kind label, so a search for
 *   "exercise" finds rows whose title never says so.
 */
export function matchesFilters(
  item: CurriculumTreeItemNode,
  filters: StructureFilters,
  typeLabel: string,
): boolean {
  if (filters.type !== 'all' && materialGroup(getMaterialKind(item)) !== filters.type) return false;
  if (filters.state !== 'all' && blockState(item) !== filters.state) return false;

  const query = filters.query.trim().toLowerCase();
  if (!query) return true;
  return `${item.title ?? ''} ${typeLabel}`.toLowerCase().includes(query);
}
