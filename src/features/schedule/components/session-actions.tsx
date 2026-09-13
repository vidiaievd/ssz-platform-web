'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CalendarClock, Check, Loader2, MoreHorizontal, X } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { patchSession } from '@/features/groups/api/mutations';

type Props = {
  workspaceId: string;
  groupId: string;
  sessionId: string;
  title: string;
  date: string;
  start: string;
  end: string;
  status: string;
};

/**
 * What a tutor does to a lesson from the week itself: mark it held, call it off, move it.
 *
 * All three already existed on the group's own log, four clicks away — and a tutor's main
 * screen is this one, so keeping them there meant leaving the screen to record the thing
 * that just happened (plan 62, §2 C and D1). The editor's rules are the server's: a lesson
 * cannot be held before it happens, and the refusal is shown in the tutor's words.
 */
export function SessionActions({
  workspaceId,
  groupId,
  sessionId,
  title,
  date,
  start,
  end,
  status,
}: Props) {
  const t = useTranslations('Scheduling.my.actions');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [moving, setMoving] = useState(false);
  const [newDate, setNewDate] = useState(date);
  const [newStart, setNewStart] = useState(start);
  const [newEnd, setNewEnd] = useState(end);

  function apply(changes: Parameters<typeof patchSession>[3], done: string) {
    startTransition(async () => {
      const result = await patchSession(workspaceId, groupId, sessionId, changes);
      if (!result.ok) {
        // The server's reason, not ours: "a lesson cannot be held before it happens" says
        // more than "could not save".
        toast.error(('error' in result && result.error) || t('failed'));
        return;
      }
      toast.success(done);
      setMoving(false);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('label', { title })}
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
          {status !== 'held' && (
            <DropdownMenuItem onSelect={() => apply({ status: 'held' }, t('heldDone'))}>
              <Check className="mr-2 size-3.5" aria-hidden />
              {t('markHeld')}
            </DropdownMenuItem>
          )}
          {status !== 'cancelled' && (
            <DropdownMenuItem onSelect={() => apply({ status: 'cancelled' }, t('cancelledDone'))}>
              <X className="mr-2 size-3.5" aria-hidden />
              {t('cancel')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setMoving(true)}>
            <CalendarClock className="mr-2 size-3.5" aria-hidden />
            {t('move')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={moving} onOpenChange={setMoving}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('moveTitle', { title })}</DialogTitle>
            <DialogDescription>{t('moveDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="move-date">{t('date')}</Label>
              <Input
                id="move-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="move-start">{t('from')}</Label>
                <Input
                  id="move-start"
                  type="time"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="move-end">{t('to')}</Label>
                <Input
                  id="move-end"
                  type="time"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoving(false)} disabled={isPending}>
              {t('back')}
            </Button>
            <Button
              onClick={() =>
                apply(
                  { date: newDate, start: newStart, end: newEnd, status: 'moved' },
                  t('movedDone'),
                )
              }
              disabled={isPending || newEnd <= newStart}
            >
              {isPending && <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />}
              {t('moveSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
