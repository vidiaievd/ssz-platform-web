import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface LearningSkeletonProps {
  variant?: 'card' | 'list' | 'player' | 'text';
  rows?: number;
  className?: string;
}

export function LearningSkeleton({ variant = 'list', rows = 3, className }: LearningSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading…"
      className={cn('space-y-3', className)}
    >
      {variant === 'card' && (
        <>
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="space-y-2 px-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </>
      )}

      {variant === 'list' && (
        Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
        ))
      )}

      {variant === 'player' && (
        <div className="space-y-2 rounded-xl border border-[var(--ssz-border-default)] p-3">
          <Skeleton className="mx-auto h-1.5 w-11/12" />
          <div className="flex justify-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      )}

      {variant === 'text' && (
        Array.from({ length: rows }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-4"
            style={{ width: `${85 - (i % 3) * 15}%` }}
          />
        ))
      )}

      <span className="sr-only">Loading…</span>
    </div>
  );
}
