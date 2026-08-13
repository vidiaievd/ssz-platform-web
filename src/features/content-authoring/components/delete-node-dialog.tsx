'use client';

import { useTranslations } from 'next-intl';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/** `blocks` is the multi-select case: one confirmation for the ticked rows. */
export type DeletableNodeKind = 'level' | 'module' | 'item' | 'blocks';

export interface DeleteNodeTarget {
  kind: DeletableNodeKind;
  /** Empty for `blocks`, which acts on the checked set rather than one node. */
  id: string;
  title: string;
  /** Levels only — how many modules sit under it. */
  moduleCount?: number;
  /** Levels, modules and bulk — how many blocks are affected. */
  blockCount?: number;
}

interface DeleteNodeDialogProps {
  target: DeleteNodeTarget | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (target: DeleteNodeTarget) => void;
  pending?: boolean;
}

/**
 * Confirms removing a node, naming it and counting what it holds.
 *
 * The wording per kind is not decoration — the three cases genuinely differ,
 * and the old single "are you sure?" hid that:
 *  - a level is a grouping, so deleting it leaves its modules in the course,
 *    ungrouped (`delete-section.handler.ts` unassigns rather than cascades);
 *  - a module or a block is only unplaced here, and the material itself
 *    survives in the library, reachable from other courses.
 *
 * The bulk case (`blocks`) is the block wording with a count instead of a name:
 * the ticked rows can sit in different modules, so naming one of them would
 * misrepresent what the button is about to do.
 */
export function DeleteNodeDialog({
  target,
  onOpenChange,
  onConfirm,
  pending,
}: DeleteNodeDialogProps) {
  const t = useTranslations('Authoring.deleteNode');

  return (
    <AlertDialog open={target !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {target && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t(`${target.kind}.title` as 'level.title', {
                  name: target.title,
                  blocks: target.blockCount ?? 0,
                })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {target.kind === 'level'
                  ? t('level.body', {
                      modules: target.moduleCount ?? 0,
                      blocks: target.blockCount ?? 0,
                    })
                  : target.kind === 'module'
                    ? t('module.body', { blocks: target.blockCount ?? 0 })
                    : target.kind === 'blocks'
                      ? t('blocks.body', { blocks: target.blockCount ?? 0 })
                      : t('item.body')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
                onClick={(e) => {
                  // Confirming runs a request; the dialog closes when the tree
                  // reloads, not the moment the button is pressed.
                  e.preventDefault();
                  onConfirm(target);
                }}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {t(`${target.kind}.confirm` as 'level.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
