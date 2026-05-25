'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlusCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
import { Alert } from '@/components/ui/alert';
import type { InviteRowValues } from '../../schemas';
import { useInviteMember } from '../../api/use-schools';
import { useCreateWizardStore } from '../../stores/create-wizard-store';
import { InviteRow, type InviteRowState } from './invite-row';

const MAX_INVITES = 10;
const emptyRow: InviteRowValues = { email: '', role: 'STUDENT' };

type InviteListProps = {
  schoolId: string;
  tutorEmail?: string;
  onDone: (sentCount: number) => void;
  formId: string;
};

type RowErrors = { email?: string; duplicate?: boolean; self?: boolean };

export function InviteList({ schoolId, tutorEmail, onDone, formId }: InviteListProps) {
  const t = useTranslations('School');
  const { invitesDraft, setInvitesDraft } = useCreateWizardStore();

  const [rows, setRows] = useState<InviteRowValues[]>(
    invitesDraft.length > 0 ? invitesDraft : [emptyRow],
  );
  const [rowStates, setRowStates] = useState<InviteRowState[]>(rows.map(() => ({ kind: 'idle' })));
  const [rowErrors, setRowErrors] = useState<RowErrors[]>(rows.map(() => ({})));
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [partialFailure, setPartialFailure] = useState<string | null>(null);

  const newRowRef = useRef<HTMLInputElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  const { mutateAsync: sendInvite } = useInviteMember(schoolId);

  useEffect(() => {
    setInvitesDraft(rows);
  }, [rows, setInvitesDraft]);

  function announce(msg: string) {
    if (liveRef.current) liveRef.current.textContent = msg;
    setTimeout(() => {
      if (liveRef.current) liveRef.current.textContent = '';
    }, 3000);
  }

  function addRow() {
    if (rows.length >= MAX_INVITES) return;
    setRows((r) => [...r, emptyRow]);
    setRowStates((s) => [...s, { kind: 'idle' }]);
    setRowErrors((e) => [...e, {}]);
    announce(t('create.invite.announce.added'));
    setTimeout(() => newRowRef.current?.focus(), 50);
  }

  function removeRow(i: number) {
    const removed = rows[i];
    setRows((r) => r.filter((_, idx) => idx !== i));
    setRowStates((s) => s.filter((_, idx) => idx !== i));
    setRowErrors((e) => e.filter((_, idx) => idx !== i));
    announce(t('create.invite.announce.removed', { email: removed?.email || `row ${i + 1}` }));
  }

  function updateRow(i: number, value: InviteRowValues) {
    setRows((r) => r.map((row, idx) => (idx === i ? value : row)));
    setRowErrors((e) => e.map((err, idx) => (idx === i ? {} : err)));
  }

  function validateRows(): boolean {
    const emails = rows.map((r) => r.email.trim().toLowerCase());
    const newErrors: RowErrors[] = rows.map((row, i) => {
      const email = row.email.trim();
      if (!email) return {};
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return { email: 'invalid' };
      if (email.toLowerCase() === tutorEmail?.toLowerCase()) return { self: true };
      if (emails.indexOf(email.toLowerCase()) !== i) return { duplicate: true };
      return {};
    });
    setRowErrors(newErrors);
    return newErrors.every((e) => Object.keys(e).length === 0);
  }

  const filledRows = rows.filter((r) => r.email.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateRows()) return;

    if (filledRows.length === 0) {
      onDone(0);
      return;
    }

    const toSend = rows
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => row.email.trim());

    toast.loading(t('create.invite.sending'), { id: 'invite-sending' });

    let sentCount = 0;
    let failedCount = 0;

    for (const { row, i } of toSend) {
      setRowStates((s) => s.map((st, idx) => (idx === i ? { kind: 'sending' } : st)));
      try {
        const inv = await sendInvite({ email: row.email.trim(), role: row.role });
        sentCount++;
        setRowStates((s) =>
          s.map((st, idx) =>
            idx === i
              ? {
                  kind: 'sent',
                  inviteUrl: inv.inviteUrl,
                  deliveryFailed: inv.deliveryFailed,
                }
              : st,
          ),
        );
        announce(t('create.invite.announce.sent', { email: row.email }));
      } catch {
        failedCount++;
        setRowStates((s) =>
          s.map((st, idx) =>
            idx === i ? { kind: 'error', message: 'Failed to send' } : st,
          ),
        );
        announce(t('create.invite.announce.failed', { email: row.email }));
      }
    }

    toast.dismiss('invite-sending');

    if (failedCount > 0 && sentCount > 0) {
      setPartialFailure(t('create.invite.partialFailure', { sent: sentCount, failed: failedCount }));
    } else if (failedCount > 0) {
      toast.error(t('create.invite.error.network'));
      return;
    }

    if (failedCount === 0) {
      onDone(sentCount);
    }
  }

  function handleSkip() {
    const hasFilledRows = rows.some((r) => r.email.trim());
    if (hasFilledRows) {
      setShowSkipDialog(true);
    } else {
      onDone(0);
    }
  }

  const remaining = MAX_INVITES - rows.length;

  return (
    <>
      {/* SR live region */}
      <div
        ref={liveRef}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        className="sr-only"
      />

      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        {partialFailure && (
          <Alert variant="warning">
            <span>{partialFailure}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => onDone(rows.filter((_, i) => rowStates[i]?.kind === 'sent').length)}
            >
              {t('create.wizard.next')}
            </Button>
          </Alert>
        )}

        <div className="space-y-3">
          {rows.map((row, i) => (
            <InviteRow
              key={i}
              ref={i === rows.length - 1 ? newRowRef : undefined}
              index={i}
              value={row}
              rowState={rowStates[i] ?? { kind: 'idle' }}
              onChange={(v) => updateRow(i, v)}
              onRemove={() => removeRow(i)}
              canRemove={rows.length > 1}
              error={rowErrors[i]}
              tutorEmail={tutorEmail}
            />
          ))}
        </div>

        {rows.length < MAX_INVITES ? (
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed gap-2"
            onClick={addRow}
          >
            <PlusCircle className="h-4 w-4" aria-hidden />
            {t('create.invite.add')}
          </Button>
        ) : (
          <p className="text-sm text-(--ssz-text-muted) text-center">
            {t('create.invite.maxReached')}
          </p>
        )}

        {remaining < MAX_INVITES && remaining > 0 && (
          <p className="text-xs text-(--ssz-text-muted)">
            {t('create.invite.remaining', { remaining })}
          </p>
        )}

        <div className="flex justify-start pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-(--ssz-text-muted)"
          >
            {t('create.invite.skipLabel')}
          </Button>
        </div>
      </form>

      {/* Skip dialog */}
      <AlertDialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('create.invite.skip.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('create.invite.skip.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('create.invite.skip.keep')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDone(0)}>
              {t('create.invite.skip.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
