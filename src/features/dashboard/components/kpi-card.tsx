import { Lock, TrendingDown, TrendingUp, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Trend } from '../types';
import { Sparkline } from './sparkline';

export type KpiCardProps = {
  label: string;
  value: number | '—';
  delta?: string;
  trend?: Trend;
  hint?: string;
  spark?: number[];
  sub?: string;
  locked?: boolean;
  loading?: boolean;
};

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'up') return <TrendingUp className="size-3.5" aria-hidden="true" />;
  if (trend === 'down') return <TrendingDown className="size-3.5" aria-hidden="true" />;
  return <Minus className="size-3.5" aria-hidden="true" />;
}

function trendColor(trend: Trend): string {
  if (trend === 'up') return 'text-success-600 dark:text-success-400';
  if (trend === 'down') return 'text-error-600 dark:text-error-400';
  return 'text-(--ssz-text-muted)';
}

export function KpiCard({
  label,
  value,
  delta,
  trend,
  hint,
  spark,
  sub,
  locked,
  loading,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="relative min-h-[108px] rounded-md border border-border bg-card p-4 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-14 mt-1" />
      </div>
    );
  }

  const displayValue = locked ? '—' : value;

  return (
    <div
      className={cn(
        'relative min-h-[108px] rounded-md border border-border bg-card p-4',
        locked && 'opacity-60',
      )}
    >
      {locked && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-warning-100 px-1.5 py-0.5 text-[10px] font-semibold text-warning-700"
              aria-label="Owner-only metric"
            >
              <Lock className="size-2.5" aria-hidden="true" />
              Owner
            </span>
          </TooltipTrigger>
          <TooltipContent>Owner-only metric</TooltipContent>
        </Tooltip>
      )}

      {/* Label */}
      <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-(--ssz-text-muted) leading-none mb-2">
        {label}
      </p>

      {/* Value + delta + sparkline row */}
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span
            className={cn(
              'text-2xl font-bold leading-none',
              displayValue === '—' ? 'text-(--ssz-text-muted)' : 'text-(--ssz-text-primary)',
            )}
          >
            {displayValue}
          </span>

          {delta && trend && !locked && (
            <span
              className={cn('flex items-center gap-0.5 text-sm font-medium', trendColor(trend))}
              aria-label={`trend: ${trend} ${delta}`}
            >
              <TrendIcon trend={trend} />
              {delta}
            </span>
          )}
        </div>

        {spark && spark.length > 0 && !locked && (
          <Sparkline
            data={spark}
            ariaLabel={`trend sparkline: ${trend ?? 'flat'} over 7 days`}
            emphasizeLast
          />
        )}
      </div>

      {/* Hint */}
      {hint && (
        <p className="mt-1.5 text-xs text-(--ssz-text-muted) leading-snug">{hint}</p>
      )}

      {/* Sub footnote */}
      {sub && !locked && (
        <>
          <hr className="my-2 border-border" />
          <p className="font-mono text-[11px] text-(--ssz-text-muted)">{sub}</p>
        </>
      )}
    </div>
  );
}
