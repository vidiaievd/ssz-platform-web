import type { CurriculumTreeModuleNode } from '@/features/content/types';

/**
 * What a draggable row carries, so a drop can be judged without reaching back
 * into the tree: which module owns it and which section it currently sits in.
 */
export interface BlockDragData {
  type: 'block';
  itemId: string;
  moduleContainerId: string;
  sectionId: string | null;
  /** Position among *all* of the module's blocks — decides which side of a row the line goes. */
  flatIndex: number;
}

/** A section's own drop zone, so an empty section is still a target. */
export interface SectionDropData {
  type: 'section';
  moduleContainerId: string;
  sectionId: string | null;
}

export type StructureDragData = BlockDragData | SectionDropData;

/**
 * What a drop should do.
 *
 * `cross-module` is a real outcome rather than a refusal to answer: the drag is
 * allowed to end there so the author gets told why nothing happened. Moving a
 * block between modules needs a cross-container move content-service does not
 * have (plan 38 §3 B3).
 */
export type BlockDropPlan =
  | { kind: 'none' }
  | { kind: 'cross-module' }
  /** Same section — one reorder of the module's items. */
  | { kind: 'reorder'; orderedItemIds: string[] }
  /** Another section of the same module — re-file, then reorder. */
  | { kind: 'move'; orderedItemIds: string[]; sectionId: string | null };

interface Entry {
  id: string;
  sectionId: string | null;
}

/**
 * The module's blocks in submission order, each tagged with its section.
 * Sections first, in their own order, then whatever belongs to none.
 */
function flattenEntries(mod: CurriculumTreeModuleNode): Entry[] {
  return [
    ...mod.sections.flatMap((section) =>
      section.items.map((item) => ({ id: item.id, sectionId: section.id })),
    ),
    ...mod.ungroupedItems.map((item) => ({ id: item.id, sectionId: null })),
  ];
}

/** Index of a module's block among all of the module's blocks. */
export function blockFlatIndex(mod: CurriculumTreeModuleNode, itemId: string): number {
  return flattenEntries(mod).findIndex((entry) => entry.id === itemId);
}

/**
 * Where a dragged block lands.
 *
 * The rule is the one every sortable list uses, and the one the drop line has
 * to agree with: the dragged block takes the target's place. Coming from above
 * it settles after the row it was dropped on (that row has moved up to fill the
 * gap); coming from below, before it.
 */
export function planBlockDrop(
  mod: CurriculumTreeModuleNode,
  active: BlockDragData,
  over: StructureDragData | null,
): BlockDropPlan {
  if (!over) return { kind: 'none' };
  if (over.type === 'block' && over.itemId === active.itemId) return { kind: 'none' };
  if (over.moduleContainerId !== active.moduleContainerId) return { kind: 'cross-module' };

  const entries = flattenEntries(mod);
  const remaining = entries.filter((entry) => entry.id !== active.itemId);
  if (remaining.length === entries.length) return { kind: 'none' };

  let index: number;
  if (over.type === 'block') {
    // The target's index *before* the block was lifted out — that is what makes
    // a downward drag land past it rather than in front of it.
    index = entries.findIndex((entry) => entry.id === over.itemId);
    if (index < 0) return { kind: 'none' };
    index = Math.min(index, remaining.length);
  } else {
    // Dropped on a section rather than on a row: the end of that section.
    const last = remaining.reduce(
      (found, entry, at) => (entry.sectionId === over.sectionId ? at : found),
      -1,
    );
    index = last < 0 ? remaining.length : last + 1;
  }

  const next = [...remaining];
  next.splice(index, 0, { id: active.itemId, sectionId: over.sectionId });
  const orderedItemIds = next.map((entry) => entry.id);

  return over.sectionId === active.sectionId
    ? { kind: 'reorder', orderedItemIds }
    : { kind: 'move', orderedItemIds, sectionId: over.sectionId };
}

/**
 * Which edge of the hovered row the insertion line belongs on. `null` means no
 * line at all — the block came from another module and cannot land here.
 */
export function dropLineSide(
  active: BlockDragData,
  overFlatIndex: number,
  overModuleContainerId: string,
): 'before' | 'after' | null {
  if (active.moduleContainerId !== overModuleContainerId) return null;
  return active.flatIndex < overFlatIndex ? 'after' : 'before';
}
