'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSession } from '@/features/groups/api/mutations';

export type LessonTarget = { groupId: string; title: string };

type Props = {
  workspaceId: string;
  targets: LessonTarget[];
  /** The day the week is showing, so an extra lesson lands where the tutor is looking. */
  defaultDate: string;
};

/**
 * One more lesson, outside the weekly pattern.
 *
 * A make-up, a crammer before an exam, an hour swapped for a missed one — the pattern
 * does not know about any of them, and the week is where a tutor notices the need for one
 * (plan 62, §2 C). It lands as an extra session, which is the same thing the group's own
 * log adds and is left alone when the plan is re-laid.
 */
export function AddLessonDialog({ workspaceId, targets, defaultDate }: Props) {
  const t = useTranslations('Scheduling.my.add');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState(targets[0]?.groupId ?? '');
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('19:00');
  const [isPending, startTransition] = useTransition();

  const endsBeforeStart = end <= start;

  function submit() {
    if (!groupId || endsBeforeStart) return;

    startTransition(async () => {
      const result = await createSession(workspaceId, groupId, {
        date,
        start,
        end,
        type: 'make_up',
      });

      if (!result.ok) {
        toast.error(('error' in result && result.error) || t('failed'));
        return;
      }

      toast.success(t('added'));
      setOpen(false);
      router.refresh();
    });
  }

  if (targets.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" aria-hidden />
          {t('trigger')}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="add-with">{t('with')}</Label>
            <select
              id="add-with"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {targets.map((target) => (
                <option key={target.groupId} value={target.groupId}>
                  {target.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-date">{t('date')}</Label>
            <Input id="add-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-start">{t('from')}</Label>
              <Input
                id="add-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-end">{t('to')}</Label>
              <Input
                id="add-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                aria-invalid={endsBeforeStart}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={isPending || endsBeforeStart}>
            {isPending && <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />}
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
