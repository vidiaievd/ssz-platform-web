'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type {
  CurriculumTree,
  CurriculumTreeItemNode,
  CurriculumTreeModuleNode,
  CurriculumTreeSectionNode,
} from '@/features/content/types';

import { reorderSectionsAction } from '../actions/section';

/** Moves the element at `index` one slot toward `direction`; no-op past either end. */
export function moveInArray<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
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
