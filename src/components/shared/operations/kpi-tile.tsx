import { cn } from '@/lib/utils';

type KpiTone = 'default' | 'danger' | 'warn' | 'success';

type KpiTileProps = {
  label: string;
  value: number | string;
  unit?: string;
  sub?: string;
  tone?: KpiTone;
  className?: string;
};

const TONE_CLASSES: Record<KpiTone, string> = {
  default: 'text-(--ssz-text-primary)',
  danger: 'text-error-600 dark:text-error-400',
  warn: 'text-warning-600 dark:text-warning-400',
  success: 'text-success-600 dark:text-success-400',
};

export function KpiTile({ label, value, unit, sub, tone = 'default', className }: KpiTileProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-xl border border-border bg-card px-4 py-3',
        className,
      )}
    >
      <span className="text-xs font-medium text-(--ssz-text-muted) leading-tight truncate">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className={cn('text-2xl font-bold leading-tight tabular-nums', TONE_CLASSES[tone])}>
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-(--ssz-text-muted)">{unit}</span>
        )}
      </div>
      {sub && (
        <span className="text-[11px] text-(--ssz-text-muted) leading-tight truncate">{sub}</span>
      )}
    </div>
  );
}
