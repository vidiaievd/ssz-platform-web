import { cn } from '@/lib/utils';

export interface ProgressBadgeProps {
  done: number;
  total: number;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function ProgressBadge({ done, total, label, size = 'md', className }: ProgressBadgeProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      role="status"
      aria-label={label ?? `${done} of ${total} complete`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'border-[var(--ssz-border-default)] bg-[var(--ssz-bg-surface)]',
        size === 'sm' ? 'text-2xs' : 'text-xs',
        className,
      )}
    >
      <span
        className="h-4 w-4 overflow-hidden rounded-full bg-[var(--ssz-bg-muted)]"
        aria-hidden="true"
      >
        <svg viewBox="0 0 16 16" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill="none" stroke="var(--ssz-border-default)" strokeWidth="2.5" />
          <circle
            cx="8" cy="8" r="6"
            fill="none"
            stroke="var(--ssz-color-primary-500)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 37.7} 37.7`}
            style={{ transition: `stroke-dasharray var(--ssz-duration-slow) var(--ssz-ease-out)` }}
          />
        </svg>
      </span>
      <span className="font-semibold tabular-nums text-(--ssz-text-primary)">
        {done}<span className="font-normal text-(--ssz-text-muted)">/{total}</span>
      </span>
      {label && <span className="text-(--ssz-text-secondary)">{label}</span>}
    </div>
  );
}
