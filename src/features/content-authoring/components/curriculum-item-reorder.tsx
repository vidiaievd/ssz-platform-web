'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CurriculumTreeItemNode, CurriculumTreeModuleNode } from '@/features/content/types';

import { assignItemSectionAction, reorderContainerItemsAction } from '../actions/container-item';
import { ReorderWithAnnouncer } from './lesson-reorder';

const NO_SECTION = '__none__';

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
