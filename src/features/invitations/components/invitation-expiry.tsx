'use client';

import { Clock } from 'lucide-react';
import { useFormatter, useNow } from 'next-intl';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { expiryLabelKind } from '@/lib/invitations/status';
import type { Invitation } from '@/features/invitations/types';
import { cn } from '@/lib/utils';

type Props = {
  invitation: Pick<Invitation, 'expiresAt' | 'acceptedAt' | 'status'>;
};

export function InvitationExpiry({ invitation }: Props) {
  const formatter = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const nowMs = now.getTime();

  const kind = expiryLabelKind(invitation, nowMs);

  if (kind === 'dash') {
    return <span className="text-muted-foreground">—</span>;
  }

  const expiresDate = new Date(invitation.expiresAt);
  const tooltipLabel = formatter.dateTime(expiresDate, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const relativeLabel = (() => {
    if (kind === 'expired') return 'Expired';
    return formatter.relativeTime(expiresDate, now);
  })();

  const isSoon = kind === 'soon';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-sm',
              isSoon && 'font-medium text-amber-600 dark:text-amber-400',
              kind === 'expired' && 'text-muted-foreground',
            )}
          >
            {isSoon && (
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            {relativeLabel}
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltipLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
