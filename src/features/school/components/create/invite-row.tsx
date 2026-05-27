'use client';

import { forwardRef, useId } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { InviteRowValues } from '../../schemas';
import { InviteLinkFallback } from './invite-link-fallback';

export type InviteRowState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; inviteUrl: string; expiresAt: string }
  | { kind: 'error'; message: string };

type InviteRowProps = {
  index: number;
  value: InviteRowValues;
  rowState: InviteRowState;
  onChange: (value: InviteRowValues) => void;
  onRemove: () => void;
  canRemove: boolean;
  error?: { email?: string; duplicate?: boolean; self?: boolean };
  tutorEmail?: string;
};

const ROLES = [
  { value: 'TEACHER', labelKey: 'role.teacher.label', helpKey: 'role.teacher.help' },
  { value: 'CONTENT_ADMIN', labelKey: 'role.contentAdmin.label', helpKey: 'role.contentAdmin.help' },
  { value: 'STUDENT', labelKey: 'role.student.label', helpKey: 'role.student.help' },
] as const;

export const InviteRow = forwardRef<HTMLInputElement, InviteRowProps>(function InviteRow(
  { index, value, rowState, onChange, onRemove, canRemove, error, tutorEmail },
  ref,
) {
  const t = useTranslations('School');
  const emailId = useId();
  const emailErrorId = useId();
  const groupLabel = t('create.invite.row.rowLabel', { index: index + 1 });

  const isSending = rowState.kind === 'sending';
  const isSent = rowState.kind === 'sent';
  const isSelf = value.email.trim().toLowerCase() === tutorEmail?.toLowerCase();

  const emailError =
    error?.self || isSelf
      ? t('create.invite.error.self')
      : error?.duplicate
        ? t('create.invite.error.duplicate')
        : error?.email
          ? t('create.invite.row.email.error.invalid')
          : undefined;

  return (
    <div role="group" aria-label={groupLabel} className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_auto] md:grid-cols-[1fr_180px_40px] gap-3 items-start">
        {/* Email */}
        <div>
          <Input
            id={emailId}
            ref={ref}
            type="email"
            autoComplete="off"
            placeholder={t('create.invite.row.email.placeholder')}
            value={value.email}
            disabled={isSending || isSent}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            hasError={Boolean(emailError)}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? emailErrorId : undefined}
          />
          {emailError && (
            <p id={emailErrorId} role="alert" className="mt-1 text-xs text-[var(--ssz-color-error-600)]">
              {emailError}
            </p>
          )}
        </div>

        {/* Role */}
        <Select
          value={value.role}
          onValueChange={(role) => onChange({ ...value, role: role as InviteRowValues['role'] })}
          disabled={isSending || isSent}
        >
          <SelectTrigger className="w-full" aria-label={t('create.invite.row.role.label')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map(({ value: rv, labelKey, helpKey }) => (
              <SelectItem key={rv} value={rv}>
                <span className="font-medium">{t(labelKey)}</span>
                <span className="ml-1 text-xs text-(--ssz-text-muted)">{t(helpKey)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Remove / spinner */}
        <div className="flex items-center justify-center h-9">
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin text-(--ssz-text-muted)" aria-hidden />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              disabled={!canRemove || isSent}
              aria-label={t('create.invite.remove', { email: value.email || `row ${index + 1}` })}
              className="h-9 w-9 text-(--ssz-text-muted) hover:text-(--ssz-color-error-600)"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {/* Invite link — always shown on success so user can share manually */}
      {rowState.kind === 'sent' && (
        <InviteLinkFallback email={value.email} inviteUrl={rowState.inviteUrl} />
      )}
    </div>
  );
});
