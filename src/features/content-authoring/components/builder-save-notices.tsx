'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import type { BuilderSaveStatus } from './builder-frame';

/**
 * Where a save that did not work gets told.
 *
 * Not in the editor's top bar. That strip is one line wide and already carries a step
 * rail; anything longer than "Saved at 12:03" squeezes the rail into a scrollbar, which
 * is how a save problem ended up breaking the layout of the thing it was reporting on.
 * More to the point, a failure is an event and a bar is a status line: the bar keeps
 * `Saving… / Saved`, and the three ways a save can fail are raised where there is room to
 * say what happened.
 *
 * Each of the three gets the treatment its nature asks for:
 *
 * - **failed** — the wire blinked and the backoff is already retrying. The first one is
 *   not news; it is said only when a second follows it, because a notice that cries wolf
 *   is a notice the author learns to dismiss unread.
 * - **rejected** — the server will not take this document, and no retry changes that. The
 *   toast stays until something changes, and carries the service's own sentence: "the
 *   rubric must be a string" is a thing to go and fix, "save failed" is not.
 * - **conflict** — not a notice at all but a decision, and a toast that faded would take
 *   the decision with it. It gets a dialog with the two real answers and no third way of
 *   dismissing it, because a document that quietly stops saving is the failure mode this
 *   whole file exists to avoid.
 */

/** One id, so a later notice replaces the earlier one instead of stacking. */
const TOAST_ID = 'builder-save';

export interface BuilderSaveNoticesOptions {
  status: BuilderSaveStatus;
  /** What the server said when it refused the document. */
  rejection: string | null;
  /** Transient failures in a row — the first is ridden out silently. */
  failures: number;
  onRetry: () => void;
}

export function useBuilderSaveNotices({
  status,
  rejection,
  failures,
  onRetry,
}: BuilderSaveNoticesOptions): void {
  const t = useTranslations('Authoring.builder');
  // Read at fire time: a toast built with the render's callback would retry with whatever
  // document that render happened to hold.
  const retryRef = useRef(onRetry);
  useEffect(() => {
    retryRef.current = onRetry;
  });

  useEffect(() => {
    if (status === 'rejected') {
      toast.error(t('saveRejected'), {
        id: TOAST_ID,
        description: rejection ?? t('saveRejectedNoReason'),
        duration: Infinity,
        action: { label: t('saveRetry'), onClick: () => retryRef.current() },
      });
      return;
    }

    if (status === 'failed' && failures > 1) {
      toast.error(t('saveFailed'), { id: TOAST_ID });
      return;
    }

    // A save landed, so whatever was on screen about the last one is no longer true.
    if (status === 'saved') toast.dismiss(TOAST_ID);
  }, [status, rejection, failures, t]);
}

export interface BuilderConflictDialogProps {
  open: boolean;
  onOverwrite: () => void;
  /** Read the version that won instead — the author's unsaved edits go with it. */
  onDiscard: () => void;
}

/**
 * Someone else saved this exercise first.
 *
 * Two answers, both of which end the state, and no way out that ends it in neither: the
 * author's work is on screen and unsaved, and a dialog they could wave away would leave
 * an editor that looks normal and writes nothing. Escape and the backdrop are inert for
 * the same reason.
 */
export function BuilderConflictDialog({
  open,
  onOverwrite,
  onDiscard,
}: BuilderConflictDialogProps) {
  const t = useTranslations('Authoring.builder');

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('saveConflictTitle')}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{t('saveConflictBody')}</p>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onDiscard}>
            {t('saveConflictDiscard')}
          </Button>
          <Button type="button" onClick={onOverwrite}>
            {t('saveOverwrite')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
