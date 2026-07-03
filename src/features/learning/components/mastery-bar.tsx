import { cn } from '@/lib/utils';

export interface MasteryBarProps {
  /** 0–100 */
  value: number;
  skill?: string;
  showLabel?: boolean;
  className?: string;
}

function tier(value: number): 'high' | 'medium' | 'low' {
  if (value >= 70) return 'high';
  if (value >= 50) return 'medium';
  return 'low';
}

const TRACK_COLOR: Record<ReturnType<typeof tier>, string> = {
  high:   'bg-[var(--ssz-color-primary-500)]',
  medium: 'bg-[var(--ssz-color-secondary-500)]',
  low:    'bg-[var(--ssz-color-warning-500)]',
};

export function MasteryBar({ value, skill, showLabel = true, className }: MasteryBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const level   = tier(clamped);

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {(skill || showLabel) && (
        <div className="flex items-center justify-between gap-2">
          {skill && (
            <span className="truncate text-xs font-medium text-(--ssz-text-secondary)">
              {skill}
            </span>
          )}
          {showLabel && (
            <span className="shrink-0 text-xs tabular-nums text-(--ssz-text-muted)">
              {clamped}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={skill ? `${skill}: ${clamped}%` : `Mastery: ${clamped}%`}
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--ssz-bg-muted)]"
      >
        <div
          className={cn('h-full rounded-full transition-[width]', TRACK_COLOR[level])}
          style={{
            width: `${clamped}%`,
            transitionDuration: 'var(--ssz-duration-slow)',
            transitionTimingFunction: 'var(--ssz-ease-out)',
          }}
        />
      </div>
    </div>
  );
}
