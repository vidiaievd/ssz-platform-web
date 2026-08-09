import type { CurriculumTreeItemNode, CurriculumTreeModuleNode } from '@/features/content/types';

/**
 * What a draggable row carries: enough to find it again, and to tell a drop in
 * its own module from one in somebody else's.
 *
 * Deliberately not its section or its position — those are read from the module
 * when a drop is judged. While a drag is in flight the tree renders a preview in
 * which the block has already moved, and data captured at drag start would be
 * describing a row that is no longer where it says it is.
 */
export interface BlockDragData {
  type: 'block';
  itemId: string;
  moduleContainerId: string;
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

/**
 * Where a dragged block lands.
 *
 * The rule is the one every sortable list uses: the dragged block takes the
 * target's place. Coming from above it settles after the row it was dropped on
 * (that row has moved up to fill the gap); coming from below, before it.
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
  const from = entries.find((entry) => entry.id === active.itemId);
  if (!from) return { kind: 'none' };
  const remaining = entries.filter((entry) => entry.id !== active.itemId);

  // Where the block is heading. A row names its section only by sitting in it,
  // and the section it sits in is a fact about the module, not about the drag.
  const targetSectionId =
    over.type === 'block'
      ? (entries.find((entry) => entry.id === over.itemId)?.sectionId ?? null)
      : over.sectionId;

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
      (found, entry, at) => (entry.sectionId === targetSectionId ? at : found),
      -1,
    );
    index = last < 0 ? remaining.length : last + 1;
  }

  const next = [...remaining];
  next.splice(index, 0, { id: active.itemId, sectionId: targetSectionId });
  const orderedItemIds = next.map((entry) => entry.id);

  return targetSectionId === from.sectionId
    ? { kind: 'reorder', orderedItemIds }
    : { kind: 'move', orderedItemIds, sectionId: targetSectionId };
}

/**
 * The module as it would look if the drag ended here — what the tree renders
 * while a block is in the air, so the rows around the pointer part to show
 * where it is going.
 *
 * Built from the same plan that will be submitted, so what an author sees
 * mid-drag and what gets saved cannot come apart.
 */
export function applyBlockPreview(
  mod: CurriculumTreeModuleNode,
  movedItemId: string,
  plan: BlockDropPlan,
): CurriculumTreeModuleNode {
  if (plan.kind !== 'reorder' && plan.kind !== 'move') return mod;

  const itemsById = new Map<string, CurriculumTreeItemNode>(
    [...mod.sections.flatMap((s) => s.items), ...mod.ungroupedItems].map((item) => [
      item.id,
      item,
    ]),
  );
  const sectionByItemId = new Map(flattenEntries(mod).map((e) => [e.id, e.sectionId]));
  if (plan.kind === 'move') sectionByItemId.set(movedItemId, plan.sectionId);

  const ordered = plan.orderedItemIds
    .map((id) => itemsById.get(id))
    .filter((item): item is CurriculumTreeItemNode => item !== undefined);
  const inSection = (sectionId: string | null) =>
    ordered.filter((item) => sectionByItemId.get(item.id) === sectionId);

  return {
    ...mod,
    sections: mod.sections.map((section) => ({ ...section, items: inSection(section.id) })),
    ungroupedItems: inSection(null),
  };
}
