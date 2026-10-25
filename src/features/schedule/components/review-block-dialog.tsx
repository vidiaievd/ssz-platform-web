'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Textarea } from '@/components/ui/textarea';
import type { ReviewBlock } from '@/lib/scheduling/provider';
import {
  createMyReviewBlock,
  updateReviewBlock,
  type ReviewBlockResult,
} from '../api/review-block-actions';
import { useReviewBlockError } from './review-block-errors';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where a new block is held. Ignored when editing: a block stays in its school. */
  workspaceId: string;
  /** The block being changed; absent for a new one. */
  block?: ReviewBlock;
  /** The day the week is showing, so a new block lands where the teacher is looking. */
  defaultDate: string;
};

/**
 * Time for marking, held once or every week (plan 81).
 *
 * Mount it only while open: the fields start from the block it is given, and a dialog
 * kept mounted across a refresh would offer the rule as it was before the last save.
 *
 * One dialog for holding and for changing, because they ask the same five things. A
 * change to a series moves every sitting of it, past ones included — the server's rule,
 * and the dialog says so before the teacher saves rather than after.
 */
export function ReviewBlockDialog({ open, onOpenChange, workspaceId, block, defaultDate }: Props) {
  const t = useTranslations('Scheduling.my.reviewBlocks.dialog');
  const format = useFormatter();
  const errorText = useReviewBlockError();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [repeat, setRepeat] = useState<ReviewBlock['repeat']>(block?.repeat ?? 'weekly');
  const [startsOn, setStartsOn] = useState(block?.startsOn ?? defaultDate);
  const [endsOn, setEndsOn] = useState(block?.repeat === 'weekly' ? (block.endsOn ?? '') : '');
  const [start, setStart] = useState(block?.start ?? '16:00');
  const [end, setEnd] = useState(block?.end ?? '17:00');
  const [note, setNote] = useState(block?.note ?? '');

  const endsBeforeStart = end <= start;
  const seriesEndsEarly = repeat === 'weekly' && endsOn !== '' && endsOn < startsOn;
  const invalid = !startsOn || endsBeforeStart || seriesEndsEarly;

  function submit() {
    if (invalid) return;

    // A one-off's end is its own day, and the server sets it; a series sends its end, or
    // null for one that runs on.
    const fields = {
      repeat,
      startsOn,
      start,
      end,
      note: note.trim() === '' ? null : note.trim(),
      ...(repeat === 'weekly' ? { endsOn: endsOn === '' ? null : endsOn } : {}),
    };

    startTransition(async () => {
      const result: ReviewBlockResult = block
        ? await updateReviewBlock(block.id, fields)
        : await createMyReviewBlock(workspaceId, fields);

      if (!result.ok) {
        toast.error(errorText(result, block ? t('saveFailed') : t('createFailed')));
        return;
      }

      toast.success(block ? t('saved') : t('created'));
      onOpenChange(false);
      router.refresh();
    });
  }

  const weekday = startsOn
    ? format.dateTime(new Date(`${startsOn}T00:00:00.000Z`), { weekday: 'long', timeZone: 'UTC' })
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{block ? t('editTitle') : t('title')}</DialogTitle>
          <DialogDescription>
            {block?.repeat === 'weekly' ? t('editSeriesDescription') : t('description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Segmented
            aria-label={t('repeat')}
            size="sm"
            value={repeat}
            onValueChange={setRepeat}
            options={[
              { value: 'weekly', label: t('weekly') },
              { value: 'one_off', label: t('oneOff') },
            ]}
          />

          <div className="space-y-1.5">
            <Label htmlFor="rb-starts">{repeat === 'weekly' ? t('firstDay') : t('day')}</Label>
            <Input
              id="rb-starts"
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
            />
            {repeat === 'weekly' && weekday && (
              <p className="text-xs text-muted-foreground">{t('everyWeekday', { weekday })}</p>
            )}
          </div>

          {repeat === 'weekly' && (
            <div className="space-y-1.5">
              <Label htmlFor="rb-ends">{t('until')}</Label>
              <Input
                id="rb-ends"
                type="date"
                value={endsOn}
                min={startsOn}
                onChange={(e) => setEndsOn(e.target.value)}
                aria-invalid={seriesEndsEarly}
              />
              <p className="text-xs text-muted-foreground">{t('untilHint')}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rb-start">{t('from')}</Label>
              <Input
                id="rb-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rb-end">{t('to')}</Label>
              <Input
                id="rb-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                aria-invalid={endsBeforeStart}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rb-note">{t('note')}</Label>
            <Textarea
              id="rb-note"
              value={note}
              maxLength={500}
              rows={2}
              placeholder={t('notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={isPending || invalid}>
            {isPending && <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />}
            {block ? t('save') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
