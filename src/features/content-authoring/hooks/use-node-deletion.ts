'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import type { CurriculumTree } from '@/features/content/types';

import { deleteSectionAction } from '../actions/section';
import { removeContainerItemAction } from '../actions/container-item';
import { moduleItems } from '../lib/structure-filters';
import {
  describeLevelRemoval,
  describeRemoval,
  levelRemovalUndo,
  rowRemovalUndo,
} from '../lib/structure-restore';
import type { DeleteNodeTarget } from '../components/delete-node-dialog';

import { useStructureUndo } from './use-structure-undo';

export interface NodeDeletion {
  /** The node awaiting confirmation, or null when the dialog is closed. */
  target: DeleteNodeTarget | null;
  pending: boolean;
  request: (target: DeleteNodeTarget) => void;
  dismiss: () => void;
  confirm: (target: DeleteNodeTarget) => void;
}

interface UseNodeDeletionOptions {
  /** Undefined while the tree is still loading — the panel calls this hook above its early returns. */
  tree: CurriculumTree | undefined;
  courseContainerId: string;
  /** Reload the tree — the caller decides what stays selected afterwards. */
  onChanged: () => void;
  /**
   * The multi-select case (`kind: 'blocks'`), which only the tree can run: it
   * owns the ticked set and has to report back which rows survived.
   */
  onBulkDelete?: () => Promise<void>;
}

/**
 * Removing a node, confirmed in one dialog for all three kinds.
 *
 * Shared because two places delete: the row's ⋯ menu inside the tree, and the
 * inspector's footer. What runs differs by kind — a level is a section on the
 * course and is genuinely deleted (its modules survive, ungrouped), while a
 * module or a block is only unplaced from the container that holds it — and
 * that rule is worth having in exactly one place.
 *
 * A failed request leaves the dialog open: the author is mid-decision, and
 * closing it would report success for something that did not happen.
 */
export function useNodeDeletion({
  tree,
  courseContainerId,
  onChanged,
  onBulkDelete,
}: UseNodeDeletionOptions): NodeDeletion {
  const tErrors = useTranslations('Errors');
  const t = useTranslations('Authoring');
  const { record } = useStructureUndo();
  const [target, setTarget] = useState<DeleteNodeTarget | null>(null);
  const [pending, setPending] = useState(false);

  async function run(node: DeleteNodeTarget) {
    setPending(true);
    try {
      if (node.kind === 'blocks') {
        await onBulkDelete?.();
        setTarget(null);
        onChanged();
        return;
      }

      // What it would take to put this back, read while the tree still holds
      // it: after the request there is nothing left to describe.
      const undoEntry =
        tree &&
        (node.kind === 'level'
          ? levelUndoFor(tree, courseContainerId, node.id, t('undo.removed', { name: node.title }))
          : rowUndoFor(tree, courseContainerId, node.id, t('undo.removed', { name: node.title })));

      // A block is unplaced from whichever container holds it — the module it
      // sits in, or the course itself for material kept outside a module.
      const owningContainerId =
        node.kind === 'item'
          ? ((tree?.levels ?? [])
              .flatMap((level) => level.modules)
              .find((mod) => moduleItems(mod).some((item) => item.id === node.id))?.containerId ??
            courseContainerId)
          : courseContainerId;

      const result =
        node.kind === 'level'
          ? await deleteSectionAction(courseContainerId, node.id)
          : await removeContainerItemAction(owningContainerId, node.id);

      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      setTarget(null);
      if (undoEntry) record(undoEntry);
      onChanged();
    } finally {
      setPending(false);
    }
  }

  return {
    target,
    pending,
    request: setTarget,
    dismiss: () => setTarget(null),
    confirm: (node) => void run(node),
  };
}

function rowUndoFor(
  tree: CurriculumTree,
  courseContainerId: string,
  itemId: string,
  label: string,
) {
  const removal = describeRemoval(tree, courseContainerId, itemId);
  return removal ? rowRemovalUndo(label, [removal]) : null;
}

function levelUndoFor(
  tree: CurriculumTree,
  courseContainerId: string,
  levelId: string,
  label: string,
) {
  const level = tree.levels.find((candidate) => candidate.id === levelId);
  const removal = level ? describeLevelRemoval(tree, level) : null;
  return removal ? levelRemovalUndo(label, courseContainerId, removal) : null;
}
