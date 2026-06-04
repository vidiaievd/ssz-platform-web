import { AlertCircle, Clock, TrendingUp, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Alert, AlertType } from '../types';

const ICON_MAP: Record<AlertType, React.ReactNode> = {
  'no-primary': <Users className="size-3" aria-hidden="true" />,
  'conflict':   <Clock className="size-3" aria-hidden="true" />,
  'overload':   <TrendingUp className="size-3" aria-hidden="true" />,
  'over':       <AlertCircle className="size-3" aria-hidden="true" />,
  'under':      <AlertCircle className="size-3" aria-hidden="true" />,
};

const SHORT_LABEL: Record<AlertType, string> = {
  'no-primary': 'No teacher',
  'conflict':   'Time clash',
  'overload':   'Overloaded',
  'over':       'Over cap',
  'under':      'Under min',
};

type AlertChipProps = {
  alert: Alert;
  className?: string;
};

export function AlertChip({ alert, className }: AlertChipProps) {
  const isDanger = alert.severity === 'danger';

  return (
    <span
      title={alert.label}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        isDanger
          ? 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-400'
          : 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-400',
        className,
      )}
    >
      {ICON_MAP[alert.type]}
      <span>{SHORT_LABEL[alert.type]}</span>
    </span>
  );
}
