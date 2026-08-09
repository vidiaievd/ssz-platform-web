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

export type DeletableNodeKind = 'level' | 'module' | 'item';

export interface DeleteNodeTarget {
  kind: DeletableNodeKind;
  id: string;
  title: string;
  /** Levels only — how many modules sit under it. */
  moduleCount?: number;
  /** Levels and modules — how many blocks are affected. */
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
                {t(`${target.kind}.title` as 'level.title', { name: target.title })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {target.kind === 'level'
                  ? t('level.body', {
                      modules: target.moduleCount ?? 0,
                      blocks: target.blockCount ?? 0,
                    })
                  : target.kind === 'module'
                    ? t('module.body', { blocks: target.blockCount ?? 0 })
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
