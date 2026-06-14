import { useTranslations } from 'next-intl';
import { CheckCircle, Clock, Ban, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InvitationStatus } from '@/features/invitations/types';

type StatusMeta = {
  icon: React.ElementType;
  className: string;
};

const STATUS_META: Record<InvitationStatus, StatusMeta> = {
  accepted: {
    icon: CheckCircle,
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  pending: {
    icon: Clock,
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  },
  expired: {
    icon: AlertTriangle,
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  revoked: {
    icon: Ban,
    className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  },
};

type Props = {
  status: InvitationStatus;
  className?: string;
};

export function InvitationStatusChip({ status, className }: Props) {
  const t = useTranslations('Invitations.status');
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        meta.className,
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{t(status)}</span>
    </span>
  );
}
