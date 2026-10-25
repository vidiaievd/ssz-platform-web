'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CalendarX, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import type { ReviewBlock } from '@/lib/scheduling/provider';
import { deleteReviewBlock, skipReviewBlockDay } from '../api/review-block-actions';
import { ReviewBlockDialog } from './review-block-dialog';
import { useReviewBlockError } from './review-block-errors';

type Props = {
  workspaceId: string;
  block: ReviewBlock;
  /** The sitting the menu was opened on — the day "not this time" takes out. */
  date: string;
  /** How the sitting is named to a screen reader: "Marking, 16:00–17:00". */
  label: string;
};

/**
 * What a teacher does to their marking time from the week: change the rule, take one
 * sitting out of a series, or remove the block.
 *
 * Taking a day out is offered only on a series; a one-off has nothing left once its day
 * is gone, so for it the same wish is "remove". Removing a series removes every sitting,
 * which is why it asks first.
 */
export function ReviewBlockActionsMenu({ workspaceId, block, date, label }: Props) {
  const t = useTranslations('Scheduling.my.reviewBlocks.actions');
  const errorText = useReviewBlockError();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);

  const weekly = block.repeat === 'weekly';

  function run(call: () => ReturnType<typeof deleteReviewBlock>, done: string) {
    startTransition(async () => {
      const result = await call();
      if (!result.ok) {
        toast.error(errorText(result, t('failed')));
        return;
      }
      toast.success(done);
      setRemoving(false);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('label', { label })}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <MoreHorizontal className="size-3.5" aria-hidden />
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil className="mr-2 size-3.5" aria-hidden />
            {weekly ? t('editSeries') : t('edit')}
          </DropdownMenuItem>
          {weekly && (
            <DropdownMenuItem
              onSelect={() => run(() => skipReviewBlockDay(block.id, date), t('skipped'))}
            >
              <CalendarX className="mr-2 size-3.5" aria-hidden />
              {t('skipDay')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setRemoving(true)}
          >
            <Trash2 className="mr-2 size-3.5" aria-hidden />
            {weekly ? t('removeSeries') : t('remove')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editing && (
        <ReviewBlockDialog
          open
          onOpenChange={setEditing}
          workspaceId={workspaceId}
          block={block}
          defaultDate={date}
        />
      )}

      <AlertDialog open={removing} onOpenChange={setRemoving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {weekly ? t('removeSeriesTitle') : t('removeTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {weekly ? t('removeSeriesDescription') : t('removeDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t('back')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                // Stay open until the server answers; a refusal belongs in this dialog's
                // moment, not after it has closed.
                e.preventDefault();
                run(() => deleteReviewBlock(block.id), t('removed'));
              }}
            >
              {t('removeConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
