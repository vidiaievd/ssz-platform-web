'use client';

import { useTransition, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { canResend, resendCooldownRemaining } from '@/lib/invitations/status';
import type { Invitation } from '@/features/invitations/types';
import type { ResendResult } from '@/features/invitations/api/mutations';

type Props = {
  invitation: Invitation;
  onResend: (schoolId: string, invitationId: string) => Promise<ResendResult>;
  schoolId: string;
  onSuccess?: (updated: Pick<Invitation, 'expiresAt' | 'resendCount' | 'lastSentAt'>) => void;
};

export function ResendAction({ invitation, onResend, schoolId, onSuccess }: Props) {
  const t = useTranslations('Invitations');
  const [pending, startTransition] = useTransition();
  const [localNow] = useState(() => Date.now());

  const allowed = canResend(invitation, 120_000, localNow);
  const cooldownMs = resendCooldownRemaining(invitation, 120_000, localNow);
  const cooldownMins = Math.ceil(cooldownMs / 60_000);

  function handleResend() {
    startTransition(async () => {
      const result = await onResend(schoolId, invitation.invitationId);
      if (result.ok) {
        toast.success(t('resend.success'));
        onSuccess?.({
          expiresAt: result.expiresAt,
          resendCount: result.resendCount,
          lastSentAt: result.lastSentAt,
        });
      } else if (result.reason === 'already-accepted') {
        toast.info(t('resend.alreadyAccepted'));
      } else if (result.reason === 'throttled') {
        toast.warning(t('resend.throttled'));
      } else if (result.reason === 'gone') {
        toast.error(t('resend.gone'));
      } else {
        toast.error(t('resend.error'));
      }
    });
  }

  if (!allowed && cooldownMs > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <DropdownMenuItem disabled className="cursor-not-allowed opacity-60">
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('actions.resend')}
              </DropdownMenuItem>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {t('resend.cooldownHint', { mins: cooldownMins })}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenuItem onSelect={handleResend} disabled={pending || !allowed}>
      <RefreshCw
        className={`mr-2 h-4 w-4 ${pending ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      {t('actions.resend')}
    </DropdownMenuItem>
  );
}
