'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ClipboardCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ReviewBlockDialog } from './review-block-dialog';

type Props = {
  workspaceId: string;
  /** The day the week is showing, so the block lands where the teacher is looking. */
  defaultDate: string;
};

/** Hold time for marking from the week itself (plan 81). */
export function AddReviewBlockButton({ workspaceId, defaultDate }: Props) {
  const t = useTranslations('Scheduling.my.reviewBlocks');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ClipboardCheck className="mr-1.5 size-4" aria-hidden />
        {t('add')}
      </Button>
      {open && (
        <ReviewBlockDialog
          open
          onOpenChange={setOpen}
          workspaceId={workspaceId}
          defaultDate={defaultDate}
        />
      )}
    </>
  );
}
