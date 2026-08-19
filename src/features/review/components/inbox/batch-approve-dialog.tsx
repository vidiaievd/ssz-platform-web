'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { ReviewQueueGroup, ReviewQueueItem } from '../../types';

export interface BatchApproveDialogProps {
  /** The group the batch was started from, or null when nothing is being confirmed. */
  group: ReviewQueueGroup | null;
  /** The submissions the batch would pass — the list, resolved before the dialog opened. */
  items: ReviewQueueItem[];
  pending: boolean;
  onConfirm: (attemptIds: string[]) => void;
  onCancel: () => void;
}

/**
 * "Pass six clean" — with the six named, before the button appears.
 *
 * The whole point of this dialog is the list (criterion 8). A count is not a thing a
 * teacher can check: "6 clean" tells them nothing about *whose* work is about to be
 * marked in their name, and the one mistake this action can make — passing something the
 * teacher did not mean to — is invisible until a learner asks about it. So the names come
 * first, the warning that there is no undo comes second, and only then the button.
 *
 * What is sent is this list of ids and not "everything clean in that group": the group on
 * screen is seconds old, the queue is shared, and the server would otherwise resolve the
 * phrase against a set the teacher never saw.
 */
export function BatchApproveDialog({
  group,
  items,
  pending,
  onConfirm,
  onCancel,
}: BatchApproveDialogProps) {
  const t = useTranslations('Review.batch');

  return (
    <Dialog open={group !== null} onOpenChange={(next) => (next ? undefined : onCancel())}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t('dialog.title', { count: items.length })}</DialogTitle>
          <DialogDescription>
            {t('dialog.body', { exercise: group?.title ?? t('dialog.thisExercise') })}
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-[240px] overflow-y-auto rounded-[11px] border-[1.5px] border-border">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline justify-between gap-3 border-b border-border px-3.5 py-2 last:border-b-0"
            >
              <span className="min-w-0 truncate text-[13.5px] font-semibold">
                {item.student.name ?? item.student.id}
              </span>
              <span className="shrink-0 text-[11.5px] text-muted-foreground">
                {item.student.groupName}
              </span>
            </li>
          ))}
        </ul>

        <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-warning-700 dark:text-warning-300">
          <AlertTriangle aria-hidden className="mt-px h-4 w-4 shrink-0" />
          {t('dialog.irreversible')}
        </p>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('dialog.cancel')}
          </Button>
          <Button
            type="button"
            loading={pending}
            aria-busy={pending}
            onClick={() => onConfirm(items.map((item) => item.id))}
          >
            {t('dialog.confirm', { count: items.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
