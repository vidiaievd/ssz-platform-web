'use client';

import { useState, useCallback } from 'react';
import { RefreshCw, MailX, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
} from '@/components/ui/table';
import { InvitationRow } from './invitation-row';
import { InvitationStatusChip } from './invitation-status-chip';
import { InvitationExpiry } from './invitation-expiry';
import { ResendAction } from './resend-action';
import { RevokeDialog } from './revoke-dialog';
import {
  resendInvitation,
  revokeInvitation,
  type ResendResult,
  type RevokeResult,
} from '@/features/invitations/api/mutations';
import { isActionable } from '@/lib/invitations/status';
import type { Invitation } from '@/features/invitations/types';

type MutationFns = {
  resend: (schoolId: string, invitationId: string) => Promise<ResendResult>;
  revoke: (schoolId: string, invitationId: string) => Promise<RevokeResult>;
};

type Props = {
  invitations: Invitation[];
  schoolId: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  mutations?: MutationFns;
};

const DEFAULT_MUTATIONS: MutationFns = {
  resend: resendInvitation,
  revoke: revokeInvitation,
};

export function InvitationsTable({
  invitations: initialInvitations,
  schoolId,
  isLoading,
  error,
  onRetry,
  mutations = DEFAULT_MUTATIONS,
}: Props) {
  const t = useTranslations('Invitations.table');
  const tRoles = useTranslations('Invitations.roles');
  const tA11y = useTranslations('Invitations.a11y');
  const [items, setItems] = useState<Invitation[]>(initialInvitations);

  const handleOptimisticRemove = useCallback((invitationId: string) => {
    setItems((prev) => prev.filter((i) => i.invitationId !== invitationId));
  }, []);

  const handleRestoreRow = useCallback((invitation: Invitation) => {
    setItems((prev) => {
      if (prev.find((i) => i.invitationId === invitation.invitationId)) return prev;
      return [...prev, invitation].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    });
  }, []);

  const handleResendSuccess = useCallback(
    (invitationId: string, updated: Pick<Invitation, 'expiresAt' | 'resendCount' | 'lastSentAt'>) => {
      setItems((prev) =>
        prev.map((i) => (i.invitationId === invitationId ? { ...i, ...updated } : i)),
      );
    },
    [],
  );

  // Auto-hide role/group column when all rows share the same role and no group is set.
  const showRoleColumn =
    items.length === 0 ||
    new Set(items.map((i) => i.role)).size > 1 ||
    items.some((i) => i.targetGroupName != null);

  if (isLoading) {
    return (
      <div
        className="rounded-lg border border-border bg-card space-y-2 p-4"
        role="status"
        aria-label={tA11y('loadingLabel')}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card flex flex-col items-center gap-4 py-16 text-center">
        <MailX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('retry')}
          </Button>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card flex flex-col items-center gap-3 py-20 text-center">
        <MailX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* ── Desktop table ─────────────────────────────────────────── */}
      {/* Desktop only: below sm the same rows render as the card list below. */}
      <Table wrapperClassName="hidden sm:block" aria-label={tA11y('listLabel')}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col">{t('recipient')}</TableHead>
            {showRoleColumn && <TableHead scope="col">{t('roleGroup')}</TableHead>}
            <TableHead scope="col">{t('status')}</TableHead>
            <TableHead scope="col">{t('sent')}</TableHead>
            <TableHead scope="col">{t('expires')}</TableHead>
            <TableHead scope="col" className="w-[80px]">
              <span className="sr-only">{t('actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((inv) => (
            <InvitationRow
              key={inv.invitationId}
              invitation={inv}
              schoolId={schoolId}
              showRoleColumn={showRoleColumn}
              onResend={mutations.resend}
              onRevoke={mutations.revoke}
              onOptimisticRemove={handleOptimisticRemove}
              onRestoreRow={handleRestoreRow}
              onResendSuccess={handleResendSuccess}
            />
          ))}
        </TableBody>
      </Table>

      {/* ── Mobile cards ──────────────────────────────────────────── */}
      <ul className="sm:hidden space-y-3 p-4" aria-label={tA11y('listLabel')}>
        {items.map((inv) => {
          const actionable = isActionable(inv);
          return (
            <li
              key={inv.invitationId}
              className="rounded-lg border bg-card p-4 shadow-sm space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{inv.email}</div>
                  {showRoleColumn && (
                    <div className="text-xs text-muted-foreground">
                      {tRoles(inv.role)}
                      {inv.targetGroupName && ` · ${inv.targetGroupName}`}
                    </div>
                  )}
                </div>
                {actionable && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={tA11y('actionsLabel', { email: inv.email })}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <ResendAction
                        invitation={inv}
                        onResend={mutations.resend}
                        schoolId={schoolId}
                        onSuccess={(updated) => handleResendSuccess(inv.invitationId, updated)}
                      />
                      <RevokeDialog
                        invitation={inv}
                        onRevoke={mutations.revoke}
                        schoolId={schoolId}
                        onOptimisticRemove={handleOptimisticRemove}
                        onRestoreRow={handleRestoreRow}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <InvitationStatusChip status={inv.status} />
                <InvitationExpiry invitation={inv} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
