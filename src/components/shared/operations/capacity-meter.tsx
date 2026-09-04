import { cn } from '@/lib/utils';

type CapacityMeterProps = {
  count: number;
  min: number;
  max: number;
  /** Projected total after a pending add operation. */
  projected?: number;
  size?: 'sm' | 'md';
  className?: string;
};

type Tone = 'success' | 'warning' | 'error';

function deriveTone(count: number, min: number, max: number): Tone {
  if (count > max) return 'error';
  if (count < min) return 'warning';
  return 'success';
}

const TRACK_COLOR: Record<Tone, string> = {
  success: 'bg-success-500 dark:bg-success-600',
  warning: 'bg-warning-500 dark:bg-warning-600',
  error: 'bg-error-500 dark:bg-error-600',
};

const PROJECTED_COLOR: Record<Tone, string> = {
  success: 'bg-success-300 dark:bg-success-800',
  warning: 'bg-warning-300 dark:bg-warning-800',
  error: 'bg-error-300 dark:bg-error-800',
};

const TEXT_COLOR: Record<Tone, string> = {
  success: 'text-success-700 dark:text-success-400',
  warning: 'text-warning-700 dark:text-warning-400',
  error: 'text-error-700 dark:text-error-400',
};

export function CapacityMeter({
  count,
  min,
  max,
  projected,
  size = 'md',
  className,
}: CapacityMeterProps) {
  const effectiveCount = projected ?? count;
  const tone = deriveTone(effectiveCount, min, max);
  const fillPct = max > 0 ? Math.min((count / max) * 100, 100) : 0;
  const projectedPct = projected !== undefined && max > 0
    ? Math.min((projected / max) * 100, 100)
    : null;

  const barHeight = size === 'sm' ? 'h-1' : 'h-1.5';

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* Bar */}
      <div
        role="progressbar"
        aria-label={
          projected !== undefined
            ? `${count} of ${max} seats filled; ${projected} projected`
            : `${count} of ${max} seats filled`
        }
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn('w-full rounded-full bg-border overflow-hidden', barHeight)}
      >
        {/* Projected segment (rendered first so it's behind the actual fill) */}
        {projectedPct !== null && projectedPct > fillPct && (
          <div
            aria-hidden="true"
            className={cn(
              'absolute h-full rounded-full border border-dashed border-current opacity-60',
              PROJECTED_COLOR[tone],
            )}
            style={{ width: `${projectedPct}%` }}
          />
        )}
        {/* Actual fill */}
        <div
          className={cn('h-full rounded-full transition-[width]', TRACK_COLOR[tone])}
          style={{ width: `${fillPct}%` }}
        />
      </div>

      {/* Label */}
      <div className="flex items-center justify-between gap-1">
        <span className={cn('text-xs font-medium', TEXT_COLOR[tone])}>
          {projected !== undefined ? (
            <>
              <span>{count}</span>
              <span className="opacity-60"> → {projected}</span>
              <span className="text-(--ssz-text-muted)"> / {max}</span>
            </>
          ) : (
            <>
              {count} <span className="text-(--ssz-text-muted)">/ {max}</span>
            </>
          )}
        </span>
        {tone === 'error' && (
          <span className="text-[11px] font-semibold text-error-600 dark:text-error-400">
            over
          </span>
        )}
        {tone === 'warning' && (
          <span className="text-[11px] font-semibold text-warning-600 dark:text-warning-400">
            low
          </span>
        )}
      </div>
    </div>
  );
}
