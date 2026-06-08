import { AlertTriangle, Info, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

type BannerTone = 'danger' | 'warn' | 'info';

type BannerItem = {
  id: string;
  message: string;
};

type BannerProps = {
  tone: BannerTone;
  items: BannerItem[];
  className?: string;
};

const CONFIG = {
  danger: {
    role: 'alert' as const,
    icon: XCircle,
    bg: 'bg-error-50 border-error-200 dark:bg-error-950/30 dark:border-error-800',
    icon_: 'text-error-600 dark:text-error-400',
    text: 'text-error-700 dark:text-error-300',
  },
  warn: {
    role: 'status' as const,
    icon: AlertTriangle,
    bg: 'bg-warning-50 border-warning-200 dark:bg-warning-950/30 dark:border-warning-800',
    icon_: 'text-warning-600 dark:text-warning-400',
    text: 'text-warning-700 dark:text-warning-300',
  },
  info: {
    role: 'status' as const,
    icon: Info,
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
    icon_: 'text-blue-600 dark:text-blue-400',
    text: 'text-blue-700 dark:text-blue-300',
  },
} as const;

export function Banner({ tone, items, className }: BannerProps) {
  if (!items.length) return null;

  const cfg = CONFIG[tone];
  const Icon = cfg.icon;

  return (
    <div
      role={cfg.role}
      className={cn(
        'rounded-lg border p-3 flex flex-col gap-1.5',
        cfg.bg,
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-2">
          <Icon className={cn('size-4 shrink-0 mt-0.5', cfg.icon_)} aria-hidden="true" />
          <p className={cn('text-sm leading-snug', cfg.text)}>{item.message}</p>
        </div>
      ))}
    </div>
  );
}
