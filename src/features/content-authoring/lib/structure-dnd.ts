import type {
  CurriculumTree,
  CurriculumTreeItemNode,
  CurriculumTreeModuleNode,
} from '@/features/content/types';

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

/**
 * A row of the course itself: a module card, or a piece of material placed
 * straight on the container. Both are items of the same version and share one
 * ordered list, so they drag by the same rules.
 */
export interface CourseEntryDragData {
  type: 'courseEntry';
  itemId: string;
}

/** A level, as something to drop a module into. */
export interface LevelDropData {
  type: 'level';
  levelId: string | null;
}

/** A section's own drop zone, so an empty section is still a target. */
export interface SectionDropData {
  type: 'section';
  moduleContainerId: string;
  sectionId: string | null;
}

export type StructureDragData =
  | BlockDragData
  | SectionDropData
  | CourseEntryDragData
  | LevelDropData;

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
/** What the pointer is over: another row of the same list, or a group as a whole. */
type DropTarget = { onRow: string } | { onGroup: string | null };

/**
 * The move itself, over one flat ordered list whose rows are grouped.
 *
 * Blocks inside a module and rows of the course are the same problem twice —
 * one ordered list per version, split into groups the UI draws separately — so
 * the rule lives here once and both callers hand it their own flattening.
 */
function planEntryDrop(
  entries: Entry[],
  activeId: string,
  target: DropTarget,
): Exclude<BlockDropPlan, { kind: 'cross-module' }> {
  const from = entries.find((entry) => entry.id === activeId);
  if (!from) return { kind: 'none' };
  const remaining = entries.filter((entry) => entry.id !== activeId);

  // Where the row is heading. A row names its group only by sitting in it, and
  // that is a fact about the list, not about the drag.
  const targetSectionId =
    'onRow' in target
      ? (entries.find((entry) => entry.id === target.onRow)?.sectionId ?? null)
      : target.onGroup;

  let index: number;
  if ('onRow' in target) {
    // The target's index *before* the row was lifted out — that is what makes a
    // downward drag land past it rather than in front of it.
    index = entries.findIndex((entry) => entry.id === target.onRow);
    if (index < 0) return { kind: 'none' };
    index = Math.min(index, remaining.length);
  } else {
    // Dropped on a group rather than on a row: the end of that group.
    const last = remaining.reduce(
      (found, entry, at) => (entry.sectionId === targetSectionId ? at : found),
      -1,
    );
    index = last < 0 ? remaining.length : last + 1;
  }

  const next = [...remaining];
  next.splice(index, 0, { id: activeId, sectionId: targetSectionId });
  const orderedItemIds = next.map((entry) => entry.id);

  return targetSectionId === from.sectionId
    ? { kind: 'reorder', orderedItemIds }
    : { kind: 'move', orderedItemIds, sectionId: targetSectionId };
}

export function planBlockDrop(
  mod: CurriculumTreeModuleNode,
  active: BlockDragData,
  over: StructureDragData | null,
): BlockDropPlan {
  if (!over) return { kind: 'none' };
  if (over.type === 'block' && over.itemId === active.itemId) return { kind: 'none' };
  if (over.type !== 'block' && over.type !== 'section') return { kind: 'none' };
  if (over.moduleContainerId !== active.moduleContainerId) return { kind: 'cross-module' };

  return planEntryDrop(
    flattenEntries(mod),
    active.itemId,
    over.type === 'block' ? { onRow: over.itemId } : { onGroup: over.sectionId },
  );
}

/**
 * Every row the course version holds, grouped by level and ordered as stored.
 *
 * Modules and the container's own material live in one list in the database and
 * the reorder endpoint wants all of it, however separately the tree draws them.
 * Leaving the leaf material out — as the old module reorder did — sends a
 * partial order, which the backend rejects.
 */
export function flattenCourseEntries(tree: CurriculumTree): Entry[] {
  const groups = new Map<string | null, { id: string; position: number }[]>();
  const push = (sectionId: string | null, row: { id: string; position: number }) => {
    const rows = groups.get(sectionId);
    if (rows) rows.push(row);
    else groups.set(sectionId, [row]);
  };

  for (const level of tree.levels) {
    const sectionId = level.id ?? null;
    if (!groups.has(sectionId)) groups.set(sectionId, []);
    // Both kinds share one position sequence within their section.
    for (const mod of level.modules) push(sectionId, { id: mod.id, position: mod.position });
    for (const item of level.items) push(sectionId, { id: item.id, position: item.position });
  }
  for (const item of tree.ungroupedItems) push(null, { id: item.id, position: item.position });

  return [...groups.entries()].flatMap(([sectionId, rows]) =>
    rows.sort((a, b) => a.position - b.position).map((row) => ({ id: row.id, sectionId })),
  );
}

/**
 * Where a module — or a piece of the course's own material — lands. Levels are
 * its groups, and a drop on a level files the row at the end of it.
 */
export function planCourseEntryDrop(
  tree: CurriculumTree,
  active: CourseEntryDragData,
  over: StructureDragData | null,
): BlockDropPlan {
  if (!over) return { kind: 'none' };
  if (over.type === 'courseEntry' && over.itemId === active.itemId) return { kind: 'none' };
  if (over.type !== 'courseEntry' && over.type !== 'level') return { kind: 'none' };

  return planEntryDrop(
    flattenCourseEntries(tree),
    active.itemId,
    over.type === 'courseEntry' ? { onRow: over.itemId } : { onGroup: over.levelId },
  );
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

/**
 * The tree as the drag would leave it — the module (or piece of material) drawn
 * in the level it is heading for, in the place it would take.
 *
 * Only the dragged row changes level; everything else is re-sorted by the order
 * the plan produced. Modules and leaf material stay in their own lists because
 * that is how the tree draws a level, whatever their positions interleave to.
 */
export function applyCourseEntryPreview(
  tree: CurriculumTree,
  movedId: string,
  plan: BlockDropPlan,
): CurriculumTree {
  if (plan.kind !== 'reorder' && plan.kind !== 'move') return tree;

  const rank = new Map(plan.orderedItemIds.map((id, index) => [id, index]));
  const byRank = <T extends { id: string }>(rows: T[]) =>
    [...rows].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));

  const movedModule = tree.levels.flatMap((l) => l.modules).find((m) => m.id === movedId);
  const movedItem = [...tree.levels.flatMap((l) => l.items), ...tree.ungroupedItems].find(
    (i) => i.id === movedId,
  );
  const moving = plan.kind === 'move';
  // Where a row filed into no level goes: the trailing level that holds the
  // ungrouped modules, if the tree has one, and the root bucket otherwise.
  const hasNullLevel = tree.levels.some((level) => level.id === null);

  const levels = tree.levels.map((level) => {
    const sectionId = level.id ?? null;
    const lands = moving && plan.sectionId === sectionId;
    const modules = moving ? level.modules.filter((m) => m.id !== movedId) : level.modules;
    const items = moving ? level.items.filter((i) => i.id !== movedId) : level.items;

    return {
      ...level,
      modules: byRank(lands && movedModule ? [...modules, movedModule] : modules),
      items: byRank(lands && movedItem ? [...items, movedItem] : items),
    };
  });

  const ungrouped =
    moving && !hasNullLevel && plan.sectionId === null && movedItem
      ? byRank([...tree.ungroupedItems.filter((i) => i.id !== movedId), movedItem])
      : byRank(moving ? tree.ungroupedItems.filter((i) => i.id !== movedId) : tree.ungroupedItems);

  return { ...tree, levels, ungroupedItems: ungrouped };
}

/**
 * Levels are sections of the course, not items, so they reorder through their
 * own endpoint and get their own plan shape.
 */
export type LevelDropPlan = { kind: 'none' } | { kind: 'reorder'; orderedSectionIds: string[] };

/**
 * Where a dragged level lands, by the same rule as everything else: it takes
 * the target's place.
 *
 * A level with no id is the trailing bucket the tree invents for modules that
 * belong to no section. It is not a row in the database, so it can neither
 * travel nor be displaced.
 */
export function planLevelDrop(
  tree: CurriculumTree,
  activeLevelId: string,
  overLevelId: string | null,
): LevelDropPlan {
  if (!overLevelId || overLevelId === activeLevelId) return { kind: 'none' };

  const ids = tree.levels.map((level) => level.id).filter((id): id is string => id !== null);
  const fromIndex = ids.indexOf(activeLevelId);
  const toIndex = ids.indexOf(overLevelId);
  if (fromIndex < 0 || toIndex < 0) return { kind: 'none' };

  const next = ids.filter((id) => id !== activeLevelId);
  next.splice(toIndex, 0, activeLevelId);
  return { kind: 'reorder', orderedSectionIds: next };
}

/** The tree with its levels in the order the drag would leave them. */
export function applyLevelPreview(
  tree: CurriculumTree,
  orderedSectionIds: string[],
): CurriculumTree {
  const rank = new Map(orderedSectionIds.map((id, index) => [id, index]));
  // The idless bucket has no place in the order and stays where it always is,
  // at the end; sorting is stable, so equal ranks keep their relative order.
  const rankOf = (id: string | null) =>
    id === null ? Number.MAX_SAFE_INTEGER : (rank.get(id) ?? Number.MAX_SAFE_INTEGER);

  return { ...tree, levels: [...tree.levels].sort((a, b) => rankOf(a.id) - rankOf(b.id)) };
}
