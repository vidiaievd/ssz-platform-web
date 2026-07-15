'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  CurriculumTree,
  CurriculumTreeItemNode,
  CurriculumTreeLevelNode,
  CurriculumTreeModuleNode,
  CurriculumTreeSectionNode,
} from '@/features/content/types';

import { assignItemSectionAction, reorderContainerItemsAction } from '../actions/container-item';
import { reorderSectionsAction } from '../actions/section';
import { ReorderWithAnnouncer } from './lesson-reorder';

const NO_SECTION = '__none__';

/** Moves the element at `index` one slot toward `direction`; no-op past either end. */
function moveInArray<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= items.length) return [...items];
  const copy = [...items];
  const [moved] = copy.splice(index, 1);
  copy.splice(newIndex, 0, moved as T);
  return copy;
}

/** Every module id across the whole course, in submission order — mirrors `flattenModuleItemIds` below but one level up (course → levels → modules). */
function flattenModuleIds(tree: CurriculumTree): string[] {
  return tree.levels.flatMap((l) => l.modules.map((m) => m.id));
}

/** Recomputes the full course-version module order after one level's modules were reordered in isolation (same splice-in-place approach as `computeReorderedItemIds`). */
export function computeReorderedModuleIds(
  tree: CurriculumTree,
  reorderedLevelModules: CurriculumTreeModuleNode[],
): string[] {
  const flattened = flattenModuleIds(tree);
  const reorderedIds = new Set(reorderedLevelModules.map((m) => m.id));
  const insertAt = flattened.findIndex((id) => reorderedIds.has(id));
  const withoutLevel = flattened.filter((id) => !reorderedIds.has(id));
  withoutLevel.splice(insertAt, 0, ...reorderedLevelModules.map((m) => m.id));
  return withoutLevel;
}

interface MoveUpDownProps {
  ariaLabel: string;
  disabledUp: boolean;
  disabledDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

/** Keyboard/screen-reader-accessible reorder alternative to drag handles, for nodes (levels, modules, sections) that aren't drag-sortable flat lists. */
export function MoveUpDown({ ariaLabel, disabledUp, disabledDown, onMoveUp, onMoveDown }: MoveUpDownProps) {
  return (
    <div className="flex items-center" role="group" aria-label={ariaLabel}>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={disabledUp}
        onClick={(e) => {
          e.stopPropagation();
          onMoveUp();
        }}
        aria-label={`Move ${ariaLabel} up`}
      >
        <ChevronUp size={14} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={disabledDown}
        onClick={(e) => {
          e.stopPropagation();
          onMoveDown();
        }}
        aria-label={`Move ${ariaLabel} down`}
      >
        <ChevronDown size={14} />
      </Button>
    </div>
  );
}

interface MoveLevelProps {
  courseContainerId: string;
  levels: CurriculumTreeLevelNode[];
  level: CurriculumTreeLevelNode;
  onMoved: () => void;
}

/** Move-up/down for a level (a section on the course container) among its siblings. */
export function MoveLevel({ courseContainerId, levels, level, onMoved }: MoveLevelProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const index = levels.findIndex((l) => l.id === level.id);

  function handleMove(direction: -1 | 1) {
    const reordered = moveInArray(levels, index, direction);
    const orderedIds = reordered.map((l) => l.id).filter((id): id is string => id != null);
    reorderSectionsAction(courseContainerId, orderedIds).then((result) => {
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      onMoved();
    });
  }

  return (
    <MoveUpDown
      ariaLabel={t('structure.level')}
      disabledUp={index <= 0}
      disabledDown={index >= levels.length - 1}
      onMoveUp={() => handleMove(-1)}
      onMoveDown={() => handleMove(1)}
    />
  );
}

interface MoveModuleProps {
  courseContainerId: string;
  tree: CurriculumTree;
  level: CurriculumTreeLevelNode;
  module: CurriculumTreeModuleNode;
  onMoved: () => void;
}

/** Move-up/down for a module among its siblings within the same level. */
export function MoveModule({ courseContainerId, tree, level, module: mod, onMoved }: MoveModuleProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const index = level.modules.findIndex((m) => m.id === mod.id);

  function handleMove(direction: -1 | 1) {
    const reordered = moveInArray(level.modules, index, direction);
    const fullOrder = computeReorderedModuleIds(tree, reordered);
    reorderContainerItemsAction(courseContainerId, fullOrder).then((result) => {
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      onMoved();
    });
  }

  return (
    <MoveUpDown
      ariaLabel={t('structure.module')}
      disabledUp={index <= 0}
      disabledDown={index >= level.modules.length - 1}
      onMoveUp={() => handleMove(-1)}
      onMoveDown={() => handleMove(1)}
    />
  );
}

interface MoveSectionProps {
  moduleContainerId: string;
  sections: CurriculumTreeSectionNode[];
  section: CurriculumTreeSectionNode;
  onMoved: () => void;
}

/** Move-up/down for a section (item group) among its siblings within the same module. */
export function MoveSection({ moduleContainerId, sections, section, onMoved }: MoveSectionProps) {
  const tErrors = useTranslations('Errors');
  const index = sections.findIndex((s) => s.id === section.id);

  function handleMove(direction: -1 | 1) {
    const reordered = moveInArray(sections, index, direction);
    reorderSectionsAction(
      moduleContainerId,
      reordered.map((s) => s.id),
    ).then((result) => {
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      onMoved();
    });
  }

  return (
    <MoveUpDown
      ariaLabel={section.title}
      disabledUp={index <= 0}
      disabledDown={index >= sections.length - 1}
      onMoveUp={() => handleMove(-1)}
      onMoveDown={() => handleMove(1)}
    />
  );
}

/** Every item id in a module's own version, in submission order — the backend requires the full set. */
function flattenModuleItemIds(mod: CurriculumTreeModuleNode): string[] {
  return [
    ...mod.sections.flatMap((s) => s.items.map((i) => i.id)),
    ...mod.ungroupedItems.map((i) => i.id),
  ];
}

/**
 * Recomputes the full ordered item-id list for a module's version after one
 * section (or the ungrouped-items list) was reordered in isolation. Each
 * section's items are contiguous in the flattened order, so removing and
 * re-inserting the reordered block at its original starting index is
 * sufficient — other sections keep their relative order unchanged.
 */
export function computeReorderedItemIds(
  mod: CurriculumTreeModuleNode,
  reorderedSectionItems: CurriculumTreeItemNode[],
): string[] {
  const flattened = flattenModuleItemIds(mod);
  const reorderedIds = new Set(reorderedSectionItems.map((i) => i.id));
  const insertAt = flattened.findIndex((id) => reorderedIds.has(id));
  const withoutSection = flattened.filter((id) => !reorderedIds.has(id));
  withoutSection.splice(insertAt, 0, ...reorderedSectionItems.map((i) => i.id));
  return withoutSection;
}

interface MoveToSectionSelectProps {
  moduleContainerId: string;
  item: CurriculumTreeItemNode;
  currentSectionId: string | null;
  sections: { id: string; title: string }[];
  onMoved: () => void;
}

export function MoveToSectionSelect({
  moduleContainerId,
  item,
  currentSectionId,
  sections,
  onMoved,
}: MoveToSectionSelectProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    const nextSectionId = value === NO_SECTION ? null : value;
    if (nextSectionId === currentSectionId) return;
    startTransition(async () => {
      const result = await assignItemSectionAction(moduleContainerId, item.id, nextSectionId);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      onMoved();
    });
  }

  return (
    <Select value={currentSectionId ?? NO_SECTION} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size="sm" className="h-7 w-32 text-xs" aria-label={t('sections.assignAriaLabel')}>
        <SelectValue placeholder={t('sections.noSection')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_SECTION}>{t('sections.noSection')}</SelectItem>
        {sections.map((section) => (
          <SelectItem key={section.id} value={section.id}>
            {section.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface CurriculumSectionItemsProps {
  module: CurriculumTreeModuleNode;
  /** The items being rendered — one section's items, or the module's ungroupedItems. */
  items: CurriculumTreeItemNode[];
  onReordered: () => void;
  children: (item: CurriculumTreeItemNode, position: number) => React.ReactNode;
}

/**
 * Drag/keyboard-reorders one section's items within a module. The backend
 * requires the full ordered item-id list for the module's version (a partial
 * list is rejected), so the submission re-flattens all of the module's
 * sections + ungrouped items, splicing in just this section's new order.
 */
export function CurriculumSectionItems({
  module: mod,
  items,
  onReordered,
  children,
}: CurriculumSectionItemsProps) {
  const tErrors = useTranslations('Errors');

  function handleReorder(reordered: CurriculumTreeItemNode[]) {
    const fullOrder = computeReorderedItemIds(mod, reordered);

    reorderContainerItemsAction(mod.containerId, fullOrder).then((result) => {
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      onReordered();
    });
  }

  return (
    <ReorderWithAnnouncer items={items} onReorder={handleReorder}>
      {children}
    </ReorderWithAnnouncer>
  );
}
