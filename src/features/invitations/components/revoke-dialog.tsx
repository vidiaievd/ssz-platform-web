'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Ban } from 'lucide-react';
import type { Invitation } from '@/features/invitations/types';
import type { RevokeResult } from '@/features/invitations/api/mutations';

type Props = {
  invitation: Invitation;
  onRevoke: (schoolId: string, invitationId: string) => Promise<RevokeResult>;
  schoolId: string;
  /** Called optimistically before the server responds. */
  onOptimisticRemove: (invitationId: string) => void;
  /** Called to restore the row if revoke fails. */
  onRestoreRow: (invitation: Invitation) => void;
};

export function RevokeDialog({
  invitation,
  onRevoke,
  schoolId,
  onOptimisticRemove,
  onRestoreRow,
}: Props) {
  const t = useTranslations('Invitations');
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    onOptimisticRemove(invitation.invitationId);

    startTransition(async () => {
      const result = await onRevoke(schoolId, invitation.invitationId);

      if (result.ok) {
        let undone = false;
        toast(t('revoke.success'), {
          action: {
            label: t('revoke.undo'),
            onClick: () => {
              undone = true;
              onRestoreRow(invitation);
            },
          },
          duration: 5000,
          onDismiss: () => {
            if (undone) return;
          },
        });
      } else if (result.reason === 'already-accepted') {
        onRestoreRow(invitation);
        toast.error(t('revoke.alreadyAccepted'));
      } else if (result.reason === 'gone') {
        toast.info(t('revoke.gone'));
      } else {
        onRestoreRow(invitation);
        toast.error(t('revoke.error'));
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="text-destructive focus:text-destructive"
          disabled={pending}
        >
          <Ban className="mr-2 h-4 w-4" aria-hidden="true" />
          {t('actions.revoke')}
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('revoke.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('revoke.description', { email: invitation.email })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('revoke.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={pending}>
            {t('revoke.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
