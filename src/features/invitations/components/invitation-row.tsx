'use client';

import { MoreHorizontal, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale, useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { TableRow, TableCell } from '@/components/ui/table';
import { InvitationStatusChip } from './invitation-status-chip';
import { InvitationExpiry } from './invitation-expiry';
import { ResendAction } from './resend-action';
import { RevokeDialog } from './revoke-dialog';
import { isActionable } from '@/lib/invitations/status';
import type { Invitation } from '@/features/invitations/types';
import type {
  ResendResult,
  RevokeResult,
} from '@/features/invitations/api/mutations';

type Props = {
  invitation: Invitation;
  schoolId: string;
  showRoleColumn: boolean;
  onResend: (schoolId: string, invitationId: string) => Promise<ResendResult>;
  onRevoke: (schoolId: string, invitationId: string) => Promise<RevokeResult>;
  onOptimisticRemove: (invitationId: string) => void;
  onRestoreRow: (invitation: Invitation) => void;
  onResendSuccess: (
    invitationId: string,
    updated: Pick<Invitation, 'expiresAt' | 'resendCount' | 'lastSentAt'>,
  ) => void;
};

export function InvitationRow({
  invitation,
  schoolId,
  showRoleColumn,
  onResend,
  onRevoke,
  onOptimisticRemove,
  onRestoreRow,
  onResendSuccess,
}: Props) {
  const t = useTranslations('Invitations');
  const tRoles = useTranslations('Invitations.roles');
  const locale = useLocale();
  const actionable = isActionable(invitation);

  function copyLink() {
    if (invitation.token) {
      navigator.clipboard.writeText(
        `${window.location.origin}/${locale}/invite/${invitation.token}`,
      );
      toast.success(t('actions.linkCopied'));
    }
  }

  return (
    <TableRow>
      {/* Recipient */}
      <TableCell className="text-sm">
        <div className="font-medium">{invitation.email}</div>
        {invitation.invitedByName && (
          <div className="text-xs text-muted-foreground">
            {t('table.invitedBy', { name: invitation.invitedByName })}
          </div>
        )}
      </TableCell>

      {/* Role + Group */}
      {showRoleColumn && (
        <TableCell className="text-sm">
          <div className="font-medium">{tRoles(invitation.role)}</div>
          {invitation.targetGroupName && (
            <div className="text-xs text-muted-foreground">
              {invitation.targetGroupName}
            </div>
          )}
        </TableCell>
      )}

      {/* Status */}
      <TableCell>
        <InvitationStatusChip status={invitation.status} />
      </TableCell>

      {/* Sent */}
      <TableCell className="text-sm text-muted-foreground">
        {new Date(invitation.lastSentAt).toLocaleDateString()}
      </TableCell>

      {/* Expiry */}
      <TableCell>
        <InvitationExpiry invitation={invitation} />
      </TableCell>

      {/* Actions */}
      <TableCell className="text-right">
        {actionable ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('a11y.actionsLabel', { email: invitation.email })}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <ResendAction
                invitation={invitation}
                onResend={onResend}
                schoolId={schoolId}
                onSuccess={(updated) => onResendSuccess(invitation.invitationId, updated)}
              />
              {invitation.token && (
                <button
                  type="button"
                  className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full"
                  onClick={copyLink}
                >
                  <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('actions.copyLink')}
                </button>
              )}
              <RevokeDialog
                invitation={invitation}
                onRevoke={onRevoke}
                schoolId={schoolId}
                onOptimisticRemove={onOptimisticRemove}
                onRestoreRow={onRestoreRow}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
