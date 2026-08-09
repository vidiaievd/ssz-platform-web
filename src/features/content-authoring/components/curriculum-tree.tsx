'use client';

import { useCallback, useState, useTransition } from 'react';
import { ChevronDown, Copy, GripVertical, Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from '@/lib/i18n/navigation';
import { getLessonTypeDefinition } from '@/lib/content/lesson-types';
import type {
  AccessTier,
  ContainerPublishState,
  CurriculumTree as CurriculumTreeData,
  CurriculumTreeItemNode,
  CurriculumTreeLevelNode,
  CurriculumTreeModuleNode,
  CurriculumTreeSectionNode,
  DifficultyLevel,
  Visibility,
} from '@/features/content/types';

import type { CurriculumTreeSelection } from '../types';
import { getMaterialKind } from '../lib/material-kind';
import {
  isFiltering,
  matchesFilters,
  moduleItems,
  type StructureFilters,
} from '../lib/structure-filters';
import {
  levelCollapseKey,
  levelDomId,
  moduleCode,
  moduleCollapseKey,
  rollUpLevelPublishState,
} from '../lib/structure-nodes';
import { createModuleAction, renameContainerAction } from '../actions/container';
import { renameSectionAction, reorderSectionsAction } from '../actions/section';
import {
  assignItemSectionAction,
  removeContainerItemAction,
  reorderContainerItemsAction,
} from '../actions/container-item';
import { renameItemAction } from '../actions/rename-item';
import { isRenamableItem, type RenamableItemType } from '../lib/renamable-item';
import { PublishStateBadge } from './publish-state-badge';
import { ItemChangeBadge } from './item-change-badge';
import {
  MoveSection,
  computeReorderedItemIds,
  moveInArray,
} from './curriculum-item-reorder';
import { AddLessonPicker } from './add-lesson-picker';
import { InlineRename } from './inline-rename';
import { NodeMenu } from './node-menu';
import { DeleteNodeDialog, type DeleteNodeTarget } from './delete-node-dialog';
import { useNodeDeletion } from '../hooks/use-node-deletion';
import { StubIconButton } from './stub-controls';
import { BulkBar } from './bulk-bar';
import { checkedBlocks } from '../lib/block-selection';
import {
  applyBlockPreview,
  applyCourseEntryPreview,
  applyLevelPreview,
  planBlockDrop,
  planCourseEntryDrop,
  planLevelDrop,
  type BlockDragData,
  type BlockDropPlan,
  type CourseEntryDragData,
  type LevelDropData,
  type StructureDragData,
} from '../lib/structure-dnd';

type ChangeKind = 'level' | 'module' | 'item';

const EMPTY_KEYS: ReadonlySet<string> = new Set();

interface CurriculumTreeProps {
  tree: CurriculumTreeData;
  selectedId: string | null;
  onSelect: (selection: CurriculumTreeSelection) => void;
  /**
   * Called after a reorder, section move, or node creation persists, so the
   * caller can refetch the tree (and select the new node, if any). Awaited
   * where the tree is showing something optimistically, so the optimism can be
   * dropped exactly when the real data replaces it.
   */
  onChanged: (selectId?: string, kind?: ChangeKind) => void | Promise<void>;
  /** The course's own container id — levels are sections on it; modules attach to it as `container`-type items. */
  courseContainerId: string;
  targetLanguage: string;
  difficultyLevel: DifficultyLevel;
  visibility: Visibility;
  accessTier: AccessTier;
  /** The course's owning school — inherited by every node created from the tree. */
  ownerSchoolId?: string | null;
  /** Needed to link a block row straight to its editor. */
  schoolSlug: string;
  /**
   * Collapse keys (see `lib/structure-nodes`) of the nodes currently folded.
   * Owned by the shell so the topbar's Expand/Collapse all can drive it; a key
   * absent from the set means expanded, which is the default for a new node.
   */
  collapsed: ReadonlySet<string>;
  onToggleCollapse: (key: string) => void;
  /** Narrows which blocks are shown. Levels and modules are never hidden by it. */
  filters: StructureFilters;
}

/** Which node is being renamed in place, and how to save it. */
interface RenameControls {
  activeId: string | null;
  begin: (id: string) => void;
  cancel: () => void;
  commit: (id: string, title: string) => void;
}

/** Multi-select, which the design puts on block rows only. */
interface CheckControls {
  isChecked: (id: string) => boolean;
  toggle: (id: string) => void;
}

/**
 * The localised name of a block's material kind. Needed in two places — the row
 * shows it, and the search matches against it — so it is resolved once here
 * rather than duplicating the registry lookup.
 */
function useMaterialLabel() {
  const tContent = useTranslations('Content');
  return (item: CurriculumTreeItemNode) =>
    tContent(
      `materialType.${getLessonTypeDefinition(getMaterialKind(item)).kind}` as 'materialType.text',
    );
}

// ── shared pieces ────────────────────────────────────────────────────────────

/** Rotates rather than swapping glyphs, so collapsing reads as one motion. */
function Caret({ expanded, onToggle, label }: { expanded: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ transform: expanded ? undefined : 'rotate(-90deg)' }}
    >
      <ChevronDown size={14} />
    </button>
  );
}

/** Small square badge carrying a level index, a module code, or a material glyph. */
function Glyph({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn(
        'flex size-5.5 shrink-0 items-center justify-center rounded-xs text-[10px] font-bold',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}

function SectionLabel({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-1 mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
      <span>{title}</span>
      <i className="h-px flex-1 bg-border" />
      {right}
    </div>
  );
}

/**
 * Per-row actions. Hidden at rest and revealed on hover or selection: at four
 * tools per row and a hundred rows in a course, showing them always is what
 * made the old screen unreadable.
 */
function RowTools({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-0.5 transition-opacity',
        visible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
      )}
    >
      {children}
    </span>
  );
}

/** Bare ＋ on a section label, where a dashed pill would outweigh the label itself. */
function AddIconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex size-5 shrink-0 items-center justify-center rounded-xs text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Plus size={12} />
    </button>
  );
}

const TOOL_BUTTON =
  'flex size-6 shrink-0 items-center justify-center rounded-xs text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Dashed "＋ …" affordance used everywhere something can be added inline. */
function AddButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex h-6.5 items-center gap-1.5 rounded-sm border border-dashed border-(--ssz-border-strong) px-2 text-xs font-medium text-muted-foreground transition-colors hover:border-solid hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      <Plus size={12} />
      {label}
    </button>
  );
}

/**
 * A section as a drop target, so a block can be filed into one that is empty —
 * the case with no row to aim at, and the one an author hits when a section was
 * just created.
 */
function SectionDropZone({
  moduleContainerId,
  sectionId,
  children,
}: {
  moduleContainerId: string;
  sectionId: string | null;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `section:${moduleContainerId}:${sectionId ?? 'ungrouped'}`,
    data: { type: 'section', moduleContainerId, sectionId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn('rounded-sm', isOver && 'ring-1 ring-primary-400 ring-inset')}
    >
      {children}
    </div>
  );
}

/**
 * The card that follows the pointer. A copy rather than the row itself: the row
 * stays in the list as the gap, and the overlay is free of the list's layout, so
 * it can travel across sections without being clipped by them.
 */
function BlockDragCard({ item }: { item: CurriculumTreeItemNode }) {
  const materialLabel = useMaterialLabel();
  const def = getLessonTypeDefinition(getMaterialKind(item));
  const Icon = def.icon;

  return (
    <div className="flex w-fit max-w-100 cursor-grabbing items-center gap-2 rounded-sm border border-primary-200 bg-surface px-2 py-1.25 shadow-[var(--ssz-shadow-lg)]">
      <GripVertical size={13} className="shrink-0 text-muted-foreground" />
      <Glyph style={{ background: `color-mix(in oklch, var(${def.hueVar}) 16%, transparent)` }}>
        <Icon size={12} style={{ color: `var(${def.hueVar})` }} />
      </Glyph>
      <span className="truncate text-sm text-foreground">{item.title}</span>
      <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
        {materialLabel(item)}
      </span>
    </div>
  );
}

/**
 * A level, as a thing that can itself be picked up and put somewhere else.
 *
 * The idless bucket the tree invents for section-less modules is not a row in
 * the database, so it gets no handle: there is nothing to reorder it against.
 */
function LevelCard({
  levelId,
  domId,
  sortId,
  children,
}: {
  levelId: string | null;
  domId: string;
  sortId: string;
  /** Given the drag props, so the header can put the grip where it belongs. */
  children: (drag: {
    attributes: DraggableAttributes;
    listeners?: SyntheticListenerMap;
  }) => React.ReactNode;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: sortId,
    data: { type: 'level', levelId } satisfies LevelDropData,
    disabled: levelId === null,
  });

  return (
    // The rail scrolls here by id; the anchor sits on the wrapper so the
    // level's modules come into view with it.
    <section
      ref={setNodeRef}
      id={domId}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'mb-3 scroll-mt-4 overflow-hidden rounded-md border border-border bg-surface',
        isDragging && 'opacity-30',
      )}
    >
      {children({ attributes, listeners })}
    </section>
  );
}

/**
 * A level as a place modules go. Wraps its body in both a droppable — so an
 * empty level can still be aimed at — and the sortable list of its rows.
 */
function LevelDropZone({
  levelId,
  rowIds,
  className,
  children,
}: {
  levelId: string | null;
  rowIds: string[];
  className?: string;
  children: React.ReactNode;
}) {
  const { active, isOver, setNodeRef } = useDroppable({
    id: `level:${levelId ?? 'ungrouped'}`,
    data: { type: 'level', levelId } satisfies LevelDropData,
  });
  // A block passing overhead is on its way somewhere inside a module; lighting
  // the level up would promise it a home it cannot take.
  const receiving = (active?.data.current as StructureDragData | undefined)?.type === 'courseEntry';

  return (
    <div
      ref={setNodeRef}
      className={cn(className, isOver && receiving && 'bg-primary-50/40 dark:bg-primary-900/10')}
    >
      <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}

/** The same, for a module card — a whole lesson travelling between levels. */
function ModuleDragCard({ module: mod }: { module: CurriculumTreeModuleNode }) {
  return (
    <div className="flex w-fit max-w-120 cursor-grabbing items-center gap-2 rounded-sm border border-primary-200 bg-surface px-2 py-2 shadow-[var(--ssz-shadow-lg)]">
      <GripVertical size={13} className="shrink-0 text-muted-foreground" />
      <span className="truncate text-sm font-semibold text-foreground">{mod.title}</span>
      {mod.titleEn && (
        <span className="truncate text-xs text-muted-foreground">{mod.titleEn}</span>
      )}
      <PublishStateBadge state={mod.publishState} />
    </div>
  );
}

/** And for a level, which carries its modules with it. */
function LevelDragCard({ level }: { level: CurriculumTreeLevelNode }) {
  const t = useTranslations('Authoring');

  return (
    <div className="flex w-fit max-w-120 cursor-grabbing items-center gap-2 rounded-md border border-primary-200 bg-surface px-3 py-2 shadow-[var(--ssz-shadow-lg)]">
      <GripVertical size={13} className="shrink-0 text-muted-foreground" />
      <span className="truncate text-sm font-bold tracking-tight text-foreground">
        {level.title}
      </span>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {t('structure.moduleCount', { count: level.modules.length })}
      </span>
    </div>
  );
}

// ── block row ────────────────────────────────────────────────────────────────

function BlockRow({
  item,
  sectionTitle,
  sectionId,
  selectedId,
  onSelect,
  schoolSlug,
  courseContainerId,
  rename,
  check,
  drag,
  menu,
}: {
  item: CurriculumTreeItemNode;
  sectionTitle: string | null;
  sectionId: string | null;
  selectedId: string | null;
  onSelect: (selection: CurriculumTreeSelection) => void;
  schoolSlug: string;
  courseContainerId: string;
  rename: RenameControls;
  check: CheckControls;
  /**
   * What this row carries while dragged: a block belongs to its module's item
   * list, a piece of the course's own material to the course's. `null` on rows
   * that are not sortable.
   */
  drag: BlockDragData | CourseEntryDragData | null;
  menu?: React.ReactNode;
}) {
  const t = useTranslations('Authoring');
  const materialLabel = useMaterialLabel();
  const def = getLessonTypeDefinition(getMaterialKind(item));
  const Icon = def.icon;
  const selected = selectedId === item.id;
  const checked = check.isChecked(item.id);

  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
    data: drag ?? undefined,
    disabled: drag === null,
  });

  /**
   * `courseContainerId` here is whichever container places the row — its module,
   * or the course for material kept outside one. The inspector needs that and
   * the section to act on the row, so the selection carries both.
   */
  const select = (): CurriculumTreeSelection => ({
    kind: 'item',
    item,
    sectionTitle,
    sectionId,
    containerId: courseContainerId,
  });

  return (
    <div
      ref={setNodeRef}
      // The row the pointer is carrying is drawn by the overlay instead; this
      // one stays in the list as the gap the others slide around.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      role="treeitem"
      aria-selected={selected}
      tabIndex={0}
      onClick={() => onSelect(select())}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(select());
        }
      }}
      className={cn(
        'group mb-0.75 flex cursor-pointer items-center gap-2 rounded-sm border px-2 py-1.25 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary-200 bg-primary-50 dark:bg-primary-900/30'
          : checked
            ? 'border-transparent bg-info-50 dark:bg-info-700/25'
            : 'border-transparent bg-surface hover:border-border',
        isDragging && 'opacity-30',
      )}
    >
      {drag && (
        <button
          type="button"
          aria-label={t('structure.dragBlock', { name: item.title ?? '' })}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'shrink-0 cursor-grab touch-none text-muted-foreground transition-opacity',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={13} />
        </button>
      )}
      {/* Ticking a row must not also select it: the two answer different
          questions — "act on these" versus "show me this one". */}
      <Checkbox
        checked={checked}
        onCheckedChange={() => check.toggle(item.id)}
        onClick={(e) => e.stopPropagation()}
        aria-label={t('bulk.selectBlock', { name: item.title ?? '' })}
        className="size-3.75 rounded-xs"
      />
      <Glyph style={{ background: `color-mix(in oklch, var(${def.hueVar}) 16%, transparent)` }}>
        <Icon size={12} style={{ color: `var(${def.hueVar})` }} />
      </Glyph>
      <InlineRename
        value={item.title ?? ''}
        editing={rename.activeId === item.id}
        onCommit={(title) => rename.commit(item.id, title)}
        onCancel={rename.cancel}
      >
        <span
          className="truncate text-sm text-foreground"
          onDoubleClick={(e) => {
            if (!isRenamableItem(item)) return;
            e.stopPropagation();
            rename.begin(item.id);
          }}
        >
          {item.title}
        </span>
      </InlineRename>
      <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
        {materialLabel(item)}
      </span>
      {item.durationMinutes != null && (
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {item.durationMinutes} min
        </span>
      )}
      <ItemChangeBadge item={item} />
      <span className="flex-1" />
      <RowTools visible={selected}>
        <Link
          href={`/school/${schoolSlug}/content/${courseContainerId}/lessons/${item.id}`}
          aria-label={t('structure.openLessonEditor')}
          onClick={(e) => e.stopPropagation()}
          className={TOOL_BUTTON}
        >
          <Pencil size={13} />
        </Link>
        <StubIconButton icon={<Copy size={13} />} label={t('structure.duplicate')} />
        {menu}
      </RowTools>
    </div>
  );
}

// ── module card (a sub-lesson) ───────────────────────────────────────────────

function ModuleCard({
  module: mod,
  code,
  moduleIndex,
  selectedId,
  onSelect,
  onChanged,
  tree,
  level,
  courseContainerId,
  targetLanguage,
  difficultyLevel,
  visibility,
  ownerSchoolId,
  schoolSlug,
  filters,
  matches,
  rename,
  check,
  onRequestDelete,
  expanded,
  onToggleExpanded,
}: {
  module: CurriculumTreeModuleNode;
  code: string;
  /** Position among its level's modules — drives Move up/down. */
  moduleIndex: number;
  schoolSlug: string;
  filters: StructureFilters;
  /** Shared with the tree so a module's rows and its own expansion agree on what matches. */
  matches: (item: CurriculumTreeItemNode) => boolean;
  rename: RenameControls;
  check: CheckControls;
  /** Opens the confirmation dialog, which the tree owns. */
  onRequestDelete: (target: DeleteNodeTarget) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  selectedId: string | null;
  onSelect: (selection: CurriculumTreeSelection) => void;
  onChanged: (selectId?: string, kind?: ChangeKind) => void;
  tree: CurriculumTreeData;
  level: CurriculumTreeLevelNode;
  courseContainerId: string;
  targetLanguage: string;
  difficultyLevel: DifficultyLevel;
  visibility: Visibility;
  ownerSchoolId?: string | null;
}) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const [addLessonIn, setAddLessonIn] = useState<string | null | undefined>(undefined);
  const selected = selectedId === mod.id;
  // A module is a row of the course's own item list, which is what makes it
  // draggable between levels — same list, different group.
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: mod.id,
    data: { type: 'courseEntry', itemId: mod.id } satisfies CourseEntryDragData,
  });
  const filtering = isFiltering(filters);
  const visible = (items: CurriculumTreeItemNode[]) => items.filter(matches);

  const allItems = [...mod.sections.flatMap((s) => s.items), ...mod.ungroupedItems];
  const minutes = allItems.reduce((sum, i) => sum + (i.durationMinutes ?? 0), 0);
  const sectionOptions = mod.sections.map((s) => ({ id: s.id, title: s.title }));

  /** Reorder and section-move for one block, submitted as the module's full item order. */
  function moveItem(siblings: CurriculumTreeItemNode[], index: number, direction: -1 | 1) {
    const reordered = moveInArray(siblings, index, direction);
    reorderContainerItemsAction(mod.containerId, computeReorderedItemIds(mod, reordered)).then(
      (result) => {
        if (!result.ok) {
          toast.error(tErrors(result.error.code));
          return;
        }
        onChanged();
      },
    );
  }

  /**
   * Move up/down is the keyboard's version of dragging onto the neighbour, so it
   * asks the same planner for the answer. It used to build the order from the
   * modules alone, which left out any material placed on the course itself — a
   * partial order, which the reorder endpoint rejects outright.
   */
  function moveModule(direction: -1 | 1) {
    const neighbour = level.modules[moduleIndex + direction];
    if (!neighbour) return;
    const plan = planCourseEntryDrop(
      tree,
      { type: 'courseEntry', itemId: mod.id },
      { type: 'courseEntry', itemId: neighbour.id },
    );
    if (plan.kind !== 'reorder' && plan.kind !== 'move') return;

    reorderContainerItemsAction(courseContainerId, plan.orderedItemIds).then((result) => {
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      onChanged();
    });
  }

  function moveItemToSection(itemId: string, sectionId: string | null) {
    assignItemSectionAction(mod.containerId, itemId, sectionId).then((result) => {
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      onChanged();
    });
  }

  function renderItems(section: CurriculumTreeSectionNode | null) {
    const siblings = section ? section.items : mod.ungroupedItems;
    const items = visible(siblings);
    const sectionId = section?.id ?? null;
    if (items.length === 0) {
      return (
        <SectionDropZone moduleContainerId={mod.containerId} sectionId={sectionId}>
          <p className="px-2 py-1 text-xs italic text-muted-foreground">
            {t('structure.noLessonsYet')}
          </p>
        </SectionDropZone>
      );
    }
    return (
      <SectionDropZone moduleContainerId={mod.containerId} sectionId={sectionId}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => {
            const index = siblings.findIndex((i) => i.id === item.id);
            return (
              <BlockRow
                key={item.id}
                item={item}
                sectionTitle={section?.title ?? null}
                sectionId={section?.id ?? null}
                selectedId={selectedId}
                onSelect={onSelect}
                schoolSlug={schoolSlug}
                courseContainerId={mod.containerId}
                rename={rename}
                check={check}
                drag={{ type: 'block', itemId: item.id, moduleContainerId: mod.containerId }}
                menu={
                  <NodeMenu
                    kind="item"
                    nodeTitle={item.title ?? ''}
                    onRename={isRenamableItem(item) ? () => rename.begin(item.id) : undefined}
                    editorHref={`/school/${schoolSlug}/content/${mod.containerId}/lessons/${item.id}`}
                    canMoveUp={index > 0}
                    canMoveDown={index < siblings.length - 1}
                    onMoveUp={() => moveItem(siblings, index, -1)}
                    onMoveDown={() => moveItem(siblings, index, 1)}
                    sections={sectionOptions}
                    currentSectionId={section?.id ?? null}
                    onMoveToSection={(sectionId) => moveItemToSection(item.id, sectionId)}
                    onDelete={() =>
                      onRequestDelete({ kind: 'item', id: item.id, title: item.title ?? '' })
                    }
                    className={TOOL_BUTTON}
                  />
                }
              />
            );
          })}
        </SortableContext>
      </SectionDropZone>
    );
  }

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'mt-2 overflow-hidden rounded-sm border border-border',
        isDragging && 'opacity-30',
      )}
    >
      <header
        role="treeitem"
        aria-selected={selected}
        aria-expanded={expanded}
        tabIndex={0}
        onClick={() => onSelect({ kind: 'module', module: mod })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect({ kind: 'module', module: mod });
          }
        }}
        className={cn(
          'group flex cursor-pointer items-center gap-2 p-2 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected
            ? 'bg-primary-50 shadow-[inset_3px_0_0_var(--ssz-color-primary-500)] dark:bg-primary-900/30'
            : 'bg-surface hover:bg-subtle',
        )}
      >
        <button
          type="button"
          aria-label={t('structure.dragModule', { name: mod.title ?? '' })}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'shrink-0 cursor-grab touch-none text-muted-foreground transition-opacity',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={13} />
        </button>
        <Caret
          expanded={expanded}
          onToggle={onToggleExpanded}
          label={expanded ? 'Collapse' : 'Expand'}
        />
        <Glyph className="bg-muted text-muted-foreground">{code}</Glyph>
        <InlineRename
          value={mod.title ?? ''}
          editing={rename.activeId === mod.id}
          onCommit={(title) => rename.commit(mod.id, title)}
          onCancel={rename.cancel}
        >
          <span
            className="truncate text-sm font-semibold text-foreground"
            onDoubleClick={(e) => {
              e.stopPropagation();
              rename.begin(mod.id);
            }}
          >
            {mod.title}
          </span>
        </InlineRename>
        {mod.titleEn && (
          <span className="truncate text-xs text-muted-foreground">{mod.titleEn}</span>
        )}
        <span className="flex-1" />
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {t('structure.lessonCount', { count: allItems.length })}
          {minutes > 0 && ` · ${t('structure.minutes', { count: minutes })}`}
        </span>
        <PublishStateBadge state={mod.publishState} />
        <RowTools visible={selected}>
          <button
            type="button"
            aria-label={t('structure.addLessonTo', { name: mod.title ?? '' })}
            onClick={(e) => {
              e.stopPropagation();
              setAddLessonIn(null);
            }}
            className={TOOL_BUTTON}
          >
            <Plus size={13} />
          </button>
          <StubIconButton icon={<Copy size={13} />} label={t('structure.duplicate')} />
          <NodeMenu
            kind="module"
            nodeTitle={mod.title ?? ''}
            onRename={() => rename.begin(mod.id)}
            canMoveUp={moduleIndex > 0}
            canMoveDown={moduleIndex < level.modules.length - 1}
            onMoveUp={() => moveModule(-1)}
            onMoveDown={() => moveModule(1)}
            onDelete={() =>
              onRequestDelete({
                kind: 'module',
                id: mod.id,
                title: mod.title ?? '',
                blockCount: allItems.length,
              })
            }
            className={TOOL_BUTTON}
          />
        </RowTools>
      </header>

      {expanded && (
        <div className="border-t border-dashed border-border bg-(--ssz-bg-base) px-2 pb-3 pl-3 pt-1">
          {mod.sections.map((section) => {
            // While filtering, a section with no matches disappears; unfiltered
            // it stays and says it is empty, because an empty section is a fact
            // about the course and a filtered-out one is not.
            if (filtering && visible(section.items).length === 0) return null;
            return (
            <div key={section.id}>
              <SectionLabel
                title={section.title}
                right={
                  <>
                    {mod.sections.length > 1 && (
                      <MoveSection
                        moduleContainerId={mod.containerId}
                        sections={mod.sections}
                        section={section}
                        onMoved={onChanged}
                      />
                    )}
                    <AddIconButton
                      label={t('structure.addLessonToSection', { section: section.title })}
                      onClick={() => setAddLessonIn(section.id)}
                    />
                  </>
                }
              />
              {renderItems(section)}
            </div>
            );
          })}

          {visible(mod.ungroupedItems).length > 0 && (
            <div className="mt-2">{renderItems(null)}</div>
          )}

          {mod.sections.length === 0 && mod.ungroupedItems.length === 0 && (
            <p className="mt-2 rounded-sm border border-dashed border-(--ssz-border-strong) p-5 text-center text-xs text-muted-foreground">
              {t('structure.noLessonsYet')}
            </p>
          )}

          {filtering && allItems.length > 0 && visible(allItems).length === 0 && (
            <p className="mt-2 rounded-sm border border-dashed border-(--ssz-border-strong) p-5 text-center text-xs text-muted-foreground">
              {t('toolbar.noMatchesInModule')}
            </p>
          )}

          <div className="mt-2">
            <AddButton label={t('structure.addLesson')} onClick={() => setAddLessonIn(null)} />
          </div>
        </div>
      )}

      <AddLessonPicker
        open={addLessonIn !== undefined}
        onOpenChange={(open) => {
          if (!open) setAddLessonIn(undefined);
        }}
        moduleContainerId={mod.containerId}
        sectionId={addLessonIn ?? null}
        sectionTitle={mod.sections.find((sec) => sec.id === addLessonIn)?.title ?? null}
        targetLanguage={targetLanguage}
        difficultyLevel={difficultyLevel}
        visibility={visibility}
        ownerSchoolId={ownerSchoolId}
        onCreated={(itemId) => {
          setAddLessonIn(undefined);
          onChanged(itemId);
        }}
      />
    </article>
  );
}

// ── tree ─────────────────────────────────────────────────────────────────────

export function CurriculumTree({
  tree,
  selectedId,
  onSelect,
  onChanged,
  courseContainerId,
  targetLanguage,
  difficultyLevel,
  visibility,
  accessTier,
  ownerSchoolId,
  schoolSlug,
  collapsed,
  onToggleCollapse,
  filters,
}: CurriculumTreeProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const [isPending, startTransition] = useTransition();
  const [pendingLevelId, setPendingLevelId] = useState<string | null>(null);
  /** Which of the edited module's own sections the picker is filing into. */
  const [addOwnLessonIn, setAddOwnLessonIn] = useState<string | null>(null);
  const editingModule = tree.containerType === 'module';

  const materialLabel = useMaterialLabel();
  const filtering = isFiltering(filters);
  const matches = (item: CurriculumTreeItemNode) =>
    matchesFilters(item, filters, materialLabel(item));

  /**
   * Inline rename. One node at a time, resolved by id against the tree so each
   * kind reaches its own endpoint: a level is a section on the course, a module
   * is a container, and a block renames the entity it points at.
   */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const rename: RenameControls = {
    activeId: renamingId,
    begin: setRenamingId,
    cancel: () => setRenamingId(null),
    commit: (id, title) => {
      setRenamingId(null);
      const save = resolveRename(id, title);
      if (!save) return;
      save.then((result) => {
        if (!result.ok) {
          toast.error(tErrors(result.error.code));
          return;
        }
        onChanged();
      });
    },
  };

  /**
   * Multi-select. Only ids are held here; what they point at is resolved
   * against the current tree by `checkedBlocks`, so a row that disappears
   * under the selection cannot be acted on afterwards.
   */
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(EMPTY_KEYS);
  const check: CheckControls = {
    isChecked: (id) => checkedIds.has(id),
    toggle: (id) =>
      setCheckedIds((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
  };
  const clearChecked = useCallback(() => setCheckedIds(EMPTY_KEYS), []);
  const selectedBlocks = checkedBlocks(tree, courseContainerId, checkedIds);

  /**
   * Bulk removal. One request per block, run in order rather than at once: the
   * API unplaces a single item and rewrites the positions of its siblings, so
   * two concurrent calls against the same module would race each other.
   *
   * Blocks that failed stay ticked, which is both the honest report of what is
   * left and the shortest path to retrying them.
   */
  async function deleteCheckedBlocks() {
    const failedIds: string[] = [];
    for (const block of selectedBlocks) {
      const result = await removeContainerItemAction(block.containerId, block.id);
      if (!result.ok) failedIds.push(block.id);
    }
    setCheckedIds(new Set(failedIds));
    if (failedIds.length > 0) {
      toast.error(t('bulk.deleteFailed', { count: failedIds.length }));
    }
  }

  /** The single-node cases, shared with the inspector's footer. */
  const deletion = useNodeDeletion({
    tree,
    courseContainerId,
    onChanged: () => onChanged(),
    onBulkDelete: deleteCheckedBlocks,
  });

  /**
   * Dragging blocks. One `DndContext` spans the whole tree rather than one per
   * section, because the interesting answers are the ones that cross a
   * boundary: another section of the same module is a real move, another module
   * is not possible yet, and only a context that sees both can tell them apart.
   */
  const sensors = useSensors(
    // A short threshold: the grip sits inside a row that is itself clickable,
    // and a click that travels two pixels must stay a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * What the pointer is carrying, and where the tree is currently pretending it
   * would land. The preview is the plan already applied, so the rows part around
   * the pointer instead of standing still behind a marker.
   *
   * Two scopes, because two lists are in play: blocks belong to a module's item
   * list, while modules and the course's own material belong to the course's.
   */
  const [dragging, setDragging] = useState<
    | { kind: 'block'; item: CurriculumTreeItemNode }
    | { kind: 'module'; module: CurriculumTreeModuleNode }
    | { kind: 'level'; level: CurriculumTreeLevelNode }
    | null
  >(null);
  const [preview, setPreview] = useState<
    | { scope: 'block'; moduleContainerId: string; itemId: string; plan: BlockDropPlan }
    | { scope: 'course'; itemId: string; plan: BlockDropPlan }
    | { scope: 'level'; orderedSectionIds: string[] }
    | null
  >(null);

  const findModule = (containerId: string) =>
    tree.levels.flatMap((level) => level.modules).find((m) => m.containerId === containerId);
  const findCourseRow = (itemId: string) => {
    const mod = tree.levels.flatMap((l) => l.modules).find((m) => m.id === itemId);
    if (mod) return { kind: 'module' as const, module: mod };
    const item = [...tree.levels.flatMap((l) => l.items), ...tree.ungroupedItems].find(
      (i) => i.id === itemId,
    );
    return item ? { kind: 'block' as const, item } : null;
  };

  /** The tree and the module as the drag would leave them — what gets rendered mid-flight. */
  const viewTree =
    preview?.scope === 'course'
      ? applyCourseEntryPreview(tree, preview.itemId, preview.plan)
      : preview?.scope === 'level'
        ? applyLevelPreview(tree, preview.orderedSectionIds)
        : tree;
  function withPreview(mod: CurriculumTreeModuleNode) {
    if (preview?.scope !== 'block' || preview.moduleContainerId !== mod.containerId) return mod;
    return applyBlockPreview(mod, preview.itemId, preview.plan);
  }

  /**
   * The two lists are drawn inside one another, so the pointer is often over a
   * row of the wrong one — a module dragged across an open lesson is nearest to
   * that lesson's blocks. Rather than answering "nothing", each drag reads the
   * target as the row of *its own* list that contains it.
   */
  function resolveOver(active: StructureDragData, over: StructureDragData | null) {
    if (!over) return null;
    if (active.type === 'level') return over;
    if (active.type === 'courseEntry') {
      if (over.type === 'courseEntry' || over.type === 'level') return over;
      // Inside some module: aim at that module's own row.
      const mod = findModule(over.moduleContainerId);
      return mod ? ({ type: 'courseEntry', itemId: mod.id } satisfies CourseEntryDragData) : null;
    }
    if (active.type === 'block') {
      if (over.type === 'block' || over.type === 'section') return over;
      // Over a module header or a level: that is a cross-module drop, which the
      // planner is told about in the only way it understands — a section of
      // another container (plan 38 §3 B3).
      if (over.type === 'courseEntry') {
        const mod = tree.levels.flatMap((l) => l.modules).find((m) => m.id === over.itemId);
        if (mod) {
          return { type: 'section', moduleContainerId: mod.containerId, sectionId: null } as const;
        }
      }
      return null;
    }
    return null;
  }

  /** The plan a drag would carry out, whichever of the two lists it is in. */
  function planFor(active: StructureDragData, over: StructureDragData | null) {
    const target = resolveOver(active, over);
    if (active.type === 'block') {
      const mod = findModule(active.moduleContainerId);
      if (!mod) return null;
      return {
        containerId: mod.containerId,
        itemId: active.itemId,
        preview: {
          scope: 'block' as const,
          moduleContainerId: mod.containerId,
          itemId: active.itemId,
        },
        plan: planBlockDrop(mod, active, target),
      };
    }
    if (active.type === 'courseEntry') {
      return {
        containerId: courseContainerId,
        itemId: active.itemId,
        preview: { scope: 'course' as const, itemId: active.itemId },
        plan: planCourseEntryDrop(tree, active, target),
      };
    }
    return null;
  }

  /**
   * Levels answer separately: they are sections, reordered through their own
   * endpoint, and they have no group to move between.
   */
  function planLevelFor(active: StructureDragData, over: StructureDragData | null) {
    if (active.type !== 'level' || !active.levelId) return null;
    const target = resolveOver(active, over);
    const overLevelId =
      target?.type === 'level'
        ? target.levelId
        : target?.type === 'courseEntry'
          ? (tree.levels.find((l) => l.modules.some((m) => m.id === target.itemId) || l.items.some((i) => i.id === target.itemId))?.id ?? null)
          : target?.type === 'block' || target?.type === 'section'
            ? (tree.levels.find((l) =>
                l.modules.some((m) => m.containerId === target.moduleContainerId),
              )?.id ?? null)
            : null;

    return planLevelDrop(tree, active.levelId, overLevelId);
  }

  function handleDragStart(event: DragStartEvent) {
    const active = event.active.data.current as StructureDragData | undefined;
    if (active?.type === 'block') {
      const mod = findModule(active.moduleContainerId);
      const item = mod ? moduleItems(mod).find((i) => i.id === active.itemId) : undefined;
      setDragging(item ? { kind: 'block', item } : null);
      return;
    }
    if (active?.type === 'courseEntry') {
      setDragging(findCourseRow(active.itemId));
      return;
    }
    if (active?.type === 'level') {
      const level = tree.levels.find((l) => l.id === active.levelId);
      setDragging(level ? { kind: 'level', level } : null);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const active = event.active.data.current as StructureDragData | undefined;
    if (!active) return;
    const over = (event.over?.data.current ?? null) as StructureDragData | null;

    const levelPlan = planLevelFor(active, over);
    if (levelPlan) {
      if (levelPlan.kind === 'reorder') {
        setPreview({ scope: 'level', orderedSectionIds: levelPlan.orderedSectionIds });
      }
      return;
    }

    const resolved = planFor(active, over);
    if (!resolved) return;

    if (resolved.plan.kind === 'reorder' || resolved.plan.kind === 'move') {
      setPreview({ ...resolved.preview, plan: resolved.plan });
      return;
    }
    // A row hovering over its own previewed position answers "nothing to do",
    // and acting on that would snap it back to where it started — out from under
    // the pointer. Only a target it cannot land on clears the preview.
    if (resolved.plan.kind === 'cross-module') setPreview(null);
  }

  function endDrag() {
    setDragging(null);
    setPreview(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    // The overlay goes at once; the preview stays until the saved order comes
    // back, or the row would drop into its old place and hop to the new one a
    // moment later.
    setDragging(null);

    const active = event.active.data.current as StructureDragData | undefined;
    const over = (event.over?.data.current ?? null) as StructureDragData | null;

    const levelPlan = active ? planLevelFor(active, over) : null;
    if (levelPlan) {
      if (levelPlan.kind !== 'reorder') {
        setPreview(null);
        return;
      }
      setPreview({ scope: 'level', orderedSectionIds: levelPlan.orderedSectionIds });
      void applyLevelOrder(levelPlan.orderedSectionIds);
      return;
    }

    const resolved = active ? planFor(active, over) : null;
    if (!resolved || resolved.plan.kind === 'none' || resolved.plan.kind === 'cross-module') {
      setPreview(null);
      if (resolved?.plan.kind === 'cross-module') toast(t('structure.dragCrossModule'));
      return;
    }

    setPreview({ ...resolved.preview, plan: resolved.plan });
    void applyDropPlan(resolved.containerId, resolved.itemId, resolved.plan);
  }

  /**
   * Re-filing and ordering are two requests: the API can change an item's
   * section or the container's item order, not both at once. Order goes last,
   * so a failed re-file leaves the row where it was rather than resorted inside
   * a group it never reached.
   */
  async function applyDropPlan(
    containerId: string,
    itemId: string,
    plan: Extract<BlockDropPlan, { kind: 'reorder' | 'move' }>,
  ) {
    if (plan.kind === 'move') {
      const filed = await assignItemSectionAction(containerId, itemId, plan.sectionId);
      if (!filed.ok) {
        toast.error(tErrors(filed.error.code));
        setPreview(null);
        return;
      }
    }
    const ordered = await reorderContainerItemsAction(containerId, plan.orderedItemIds);
    if (!ordered.ok) {
      toast.error(tErrors(ordered.error.code));
      setPreview(null);
      return;
    }
    await onChanged();
    setPreview(null);
  }

  async function applyLevelOrder(orderedSectionIds: string[]) {
    const result = await reorderSectionsAction(courseContainerId, orderedSectionIds);
    if (!result.ok) {
      toast.error(tErrors(result.error.code));
      setPreview(null);
      return;
    }
    await onChanged();
    setPreview(null);
  }

  /** The menu's version of dragging a level onto its neighbour — same planner. */
  function moveLevel(index: number, direction: -1 | 1) {
    const level = tree.levels[index];
    const neighbour = tree.levels[index + direction];
    if (!level?.id || !neighbour?.id) return;

    const plan = planLevelDrop(tree, level.id, neighbour.id);
    if (plan.kind !== 'reorder') return;
    void applyLevelOrder(plan.orderedSectionIds);
  }

  function resolveRename(id: string, title: string) {
    const level = tree.levels.find((l) => l.id === id);
    if (level?.id) return renameSectionAction(courseContainerId, level.id, title);

    const mod = tree.levels.flatMap((l) => l.modules).find((m) => m.id === id);
    if (mod) return renameContainerAction(mod.containerId, title);

    const item = [
      ...tree.ungroupedItems,
      ...tree.levels.flatMap((l) => [
        ...l.items,
        ...l.modules.flatMap((m) => moduleItems(m)),
      ]),
    ].find((i) => i.id === id);
    if (item && isRenamableItem(item)) {
      return renameItemAction(
        item.itemType as RenamableItemType,
        item.refId,
        courseContainerId,
        title,
      );
    }
    return null;
  }
  const moduleMatches = (mod: CurriculumTreeModuleNode) => moduleItems(mod).some(matches);
  const levelMatches = (level: CurriculumTreeLevelNode) =>
    level.modules.some(moduleMatches) || level.items.some(matches);

  /**
   * A search is a question about the whole course, so the tree answers it by
   * opening what holds an answer and folding away what does not — including
   * nodes the author had left open. Their own collapse state is untouched
   * underneath and comes back the moment the filters are cleared.
   */
  const filterSignature = `${filters.query}|${filters.type}|${filters.state}`;
  const [overrides, setOverrides] = useState<{ signature: string; keys: ReadonlySet<string> }>({
    signature: filterSignature,
    keys: new Set(),
  });
  // Overrides belong to the query that produced them. Comparing signatures
  // discards stale ones on the next render, with no effect to reset them.
  const filterOverrides = overrides.signature === filterSignature ? overrides.keys : EMPTY_KEYS;

  function isExpanded(key: string, hasMatches: boolean) {
    if (!filtering) return !collapsed.has(key);
    // A caret must still work while filtering, so a manual toggle flips the
    // derived answer for that node until the query changes again.
    return filterOverrides.has(key) ? !hasMatches : hasMatches;
  }

  function toggleExpanded(key: string) {
    if (!filtering) {
      onToggleCollapse(key);
      return;
    }
    const next = new Set(filterOverrides);
    if (!next.delete(key)) next.add(key);
    setOverrides({ signature: filterSignature, keys: next });
  }

  function handleAddModule(levelSectionId: string | null) {
    if (isPending) return;
    setPendingLevelId(levelSectionId ?? '');
    startTransition(async () => {
      const result = await createModuleAction(
        courseContainerId,
        t('structure.newModuleTitle'),
        targetLanguage,
        difficultyLevel,
        visibility,
        accessTier,
        levelSectionId,
        ownerSchoolId,
      );
      setPendingLevelId(null);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      onChanged(result.value.itemId, 'module');
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={endDrag}
    >
      <div role="tree">
        {viewTree.levels.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('structure.empty')}</p>
        )}

        <SortableContext
          items={viewTree.levels.map(levelCollapseKey)}
          strategy={verticalListSortingStrategy}
        >
        {viewTree.levels.map((level, levelIndex) => {
          const levelKey = levelCollapseKey(level);
          const expanded = isExpanded(levelKey, levelMatches(level));
          const selected = selectedId === level.id;
          const rolledUp: ContainerPublishState | null = rollUpLevelPublishState(level);
          const blockCount = level.modules.reduce(
            (sum, m) =>
              sum + m.sections.reduce((n, s) => n + s.items.length, 0) + m.ungroupedItems.length,
            0,
          );

          return (
            <LevelCard
              key={levelKey}
              sortId={levelKey}
              levelId={level.id ?? null}
              domId={levelDomId(level)}
            >
              {(levelDrag) => (
              <>
              <header
                role="treeitem"
                aria-selected={selected}
                aria-expanded={expanded}
                tabIndex={0}
                onClick={() => onSelect({ kind: 'level', level })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect({ kind: 'level', level });
                  }
                }}
                className={cn(
                  'group flex cursor-pointer items-center gap-2 p-3 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'bg-primary-50 shadow-[inset_3px_0_0_var(--ssz-color-primary-500)] dark:bg-primary-900/30'
                    : 'bg-subtle hover:bg-muted',
                )}
              >
                {level.id && (
                  <button
                    type="button"
                    aria-label={t('structure.dragLevel', { name: level.title ?? '' })}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'shrink-0 cursor-grab touch-none text-muted-foreground transition-opacity',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                    )}
                    {...levelDrag.attributes}
                    {...levelDrag.listeners}
                  >
                    <GripVertical size={13} />
                  </button>
                )}
                <Caret
                  expanded={expanded}
                  onToggle={() => toggleExpanded(levelKey)}
                  label={expanded ? 'Collapse' : 'Expand'}
                />
                <Glyph className="bg-primary-100 text-primary-700">{levelIndex + 1}</Glyph>
                <InlineRename
                  value={level.title ?? ''}
                  editing={rename.activeId === level.id}
                  onCommit={(title) => level.id && rename.commit(level.id, title)}
                  onCancel={rename.cancel}
                >
                  <span
                    className="truncate text-sm font-bold tracking-tight text-foreground"
                    onDoubleClick={(e) => {
                      if (!level.id) return;
                      e.stopPropagation();
                      rename.begin(level.id);
                    }}
                  >
                    {level.title}
                  </span>
                </InlineRename>
                {rolledUp && <PublishStateBadge state={rolledUp} />}
                <span className="flex-1" />
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {t('structure.moduleCount', { count: level.modules.length })}
                  {` · ${t('structure.lessonCount', { count: blockCount })}`}
                </span>
                <RowTools visible={selected}>
                  <button
                    type="button"
                    disabled={isPending}
                    aria-label={
                      editingModule
                        ? t('structure.addLessonTo', { name: level.title ?? '' })
                        : t('structure.addModuleTo', { name: level.title ?? '' })
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editingModule) setAddOwnLessonIn(level.id ?? '');
                      else handleAddModule(level.id);
                    }}
                    className={TOOL_BUTTON}
                  >
                    <Plus size={13} />
                  </button>
                  <NodeMenu
                    kind="level"
                    nodeTitle={level.title ?? ''}
                    onRename={level.id ? () => rename.begin(level.id!) : undefined}
                    canMoveUp={level.id != null && levelIndex > 0}
                    canMoveDown={level.id != null && levelIndex < tree.levels.length - 1}
                    onMoveUp={() => moveLevel(levelIndex, -1)}
                    onMoveDown={() => moveLevel(levelIndex, 1)}
                    onDelete={
                      level.id
                        ? () =>
                            deletion.request({
                              kind: 'level',
                              id: level.id!,
                              title: level.title ?? '',
                              moduleCount: level.modules.length,
                              blockCount,
                            })
                        : undefined
                    }
                    className={TOOL_BUTTON}
                  />
                </RowTools>
              </header>

              {expanded && (
                <LevelDropZone
                  levelId={level.id ?? null}
                  rowIds={[...level.modules.map((m) => m.id), ...level.items.map((i) => i.id)]}
                  className="px-3 pb-3 pl-4 pt-2"
                >
                  {level.modules.length === 0 && level.items.length === 0 && !editingModule && (
                    <p className="rounded-md border border-dashed border-(--ssz-border-strong) p-6 text-center text-sm text-muted-foreground">
                      {t('structure.noModulesYet')}
                    </p>
                  )}

                  {level.modules.map((mod, mi) => (
                    <ModuleCard
                      key={mod.id}
                      module={withPreview(mod)}
                      code={moduleCode(levelIndex, mi)}
                      moduleIndex={mi}
                      selectedId={selectedId}
                      onSelect={onSelect}
                      onChanged={onChanged}
                      tree={tree}
                      level={level}
                      courseContainerId={courseContainerId}
                      targetLanguage={targetLanguage}
                      difficultyLevel={difficultyLevel}
                      visibility={visibility}
                      ownerSchoolId={ownerSchoolId}
                      schoolSlug={schoolSlug}
                      filters={filters}
                      matches={matches}
                      rename={rename}
                      check={check}
                      onRequestDelete={deletion.request}
                      expanded={isExpanded(moduleCollapseKey(mod), moduleMatches(mod))}
                      onToggleExpanded={() => toggleExpanded(moduleCollapseKey(mod))}
                    />
                  ))}

                  {/* Material attached to the edited container itself. A module
                    holds its lessons and exercises here, and the same screen
                    edits modules and courses alike. */}
                  {level.items.length > 0 && (
                    <div className="mt-2">
                      {level.items.map((item) => (
                        <BlockRow
                          key={item.id}
                          item={item}
                          sectionTitle={level.title}
                          sectionId={level.id}
                          selectedId={selectedId}
                          onSelect={onSelect}
                          schoolSlug={schoolSlug}
                          courseContainerId={courseContainerId}
                          rename={rename}
                          check={check}
                          drag={{ type: 'courseEntry', itemId: item.id }}
                        />
                      ))}
                    </div>
                  )}

                  <div className="mt-2">
                    {/* A course is built from modules; a module is built from
                      material. The same screen edits both, and it used to offer
                      "Add module" either way — leaving a module editable only
                      from its parent course. */}
                    {editingModule ? (
                      <AddButton
                        label={t('structure.addLesson')}
                        onClick={() => setAddOwnLessonIn(level.id ?? '')}
                      />
                    ) : (
                      <AddButton
                        label={t('structure.addModule')}
                        disabled={isPending}
                        onClick={() => handleAddModule(level.id)}
                      />
                    )}
                    {pendingLevelId === (level.id ?? '') && (
                      <span className="ml-2 text-xs text-muted-foreground">…</span>
                    )}
                  </div>
                </LevelDropZone>
              )}
              </>
              )}
            </LevelCard>
          );
        })}
        </SortableContext>

        {viewTree.ungroupedItems.length > 0 && (
          // Material on the container that belongs to no level. It is still a
          // row of the same item list, so it drags by the same rules — and a
          // level can be dropped out of, back down to here.
          <LevelDropZone
            levelId={null}
            rowIds={viewTree.ungroupedItems.map((item) => item.id)}
          >
            {viewTree.ungroupedItems.map((item) => (
              <BlockRow
                key={item.id}
                item={item}
                sectionTitle={null}
                sectionId={null}
                selectedId={selectedId}
                onSelect={onSelect}
                schoolSlug={schoolSlug}
                courseContainerId={courseContainerId}
                rename={rename}
                check={check}
                drag={{ type: 'courseEntry', itemId: item.id }}
              />
            ))}
          </LevelDropZone>
        )}

        {/* A module with no sections has no level row to hang the picker off,
          and its material has to be reachable from somewhere. Once it has
          sections, adding goes through them — a second, section-less entry
          point would just scatter material. */}
        {editingModule && tree.levels.length === 0 && (
          <div className="pt-1">
            <AddButton label={t('structure.addLesson')} onClick={() => setAddOwnLessonIn('')} />
          </div>
        )}

        <BulkBar
          count={selectedBlocks.length}
          pending={deletion.pending}
          escapeClears={deletion.target === null}
          onClear={clearChecked}
          onDelete={() =>
            deletion.request({
              kind: 'blocks',
              id: '',
              title: '',
              blockCount: selectedBlocks.length,
            })
          }
        />

        <DragOverlay>
          {dragging?.kind === 'block' && <BlockDragCard item={dragging.item} />}
          {dragging?.kind === 'module' && <ModuleDragCard module={dragging.module} />}
          {dragging?.kind === 'level' && <LevelDragCard level={dragging.level} />}
        </DragOverlay>

        <DeleteNodeDialog
          target={deletion.target}
          onOpenChange={(open) => {
            if (!open) deletion.dismiss();
          }}
          onConfirm={deletion.confirm}
          pending={deletion.pending}
        />

        {editingModule && (
          <AddLessonPicker
            open={addOwnLessonIn !== null}
            onOpenChange={(open) => {
              if (!open) setAddOwnLessonIn(null);
            }}
            moduleContainerId={courseContainerId}
            sectionId={addOwnLessonIn || null}
            targetLanguage={targetLanguage}
            difficultyLevel={difficultyLevel}
            visibility={visibility}
            ownerSchoolId={ownerSchoolId}
            onCreated={(itemId) => {
              setAddOwnLessonIn(null);
              onChanged(itemId);
            }}
          />
        )}
      </div>
    </DndContext>
  );
}
