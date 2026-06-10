import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { HealthState } from '@/features/teachers/types';

type HealthDotProps = {
  state: HealthState;
  className?: string;
};

const CONFIG = {
  ok: {
    icon: CheckCircle,
    label: 'Healthy',
    dot: 'bg-success-500 dark:bg-success-400',
    icon_: 'text-success-600 dark:text-success-400',
  },
  warn: {
    icon: AlertTriangle,
    label: 'Warning',
    dot: 'bg-warning-500 dark:bg-warning-400',
    icon_: 'text-warning-600 dark:text-warning-400',
  },
  danger: {
    icon: XCircle,
    label: 'Critical',
    dot: 'bg-error-500 dark:bg-error-400',
    icon_: 'text-error-600 dark:text-error-400',
  },
} as const;

export function HealthDot({ state, className }: HealthDotProps) {
  const cfg = CONFIG[state];
  const Icon = cfg.icon;
  return (
    <span
      aria-label={cfg.label}
      title={cfg.label}
      className={cn('inline-flex items-center justify-center', className)}
    >
      <Icon className={cn('size-4', cfg.icon_)} aria-hidden="true" />
    </span>
  );
}
