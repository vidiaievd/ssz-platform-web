'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface ChipProps {
  children: ReactNode;
  /** Pressed state — a chip is a toggle, and says so to assistive technology. */
  active: boolean;
  onClick: () => void;
  /** The colour the chip takes when on. Defaults to the accent. */
  tone?: string;
  /** An optional count inside the chip, for oversight's filter rows. */
  count?: number;
  className?: string;
}

/**
 * A filter you switch on and off, staying in place while you do it.
 *
 * The review system has no tabs for states — "longer than promised" is a chip and not a
 * tab precisely because a tab is somewhere else, and late work put somewhere else is late
 * work nobody opens. A pressed chip narrows the list under it; the list does not move.
 */
export function Chip({ children, active, onClick, tone, count, className }: ChipProps) {
  const colour = tone ?? 'var(--ssz-text-accent)';

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={
        active
          ? {
              color: colour,
              borderColor: colour,
              background: `color-mix(in oklch, ${colour} 8%, transparent)`,
            }
          : undefined
      }
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[9px] border-[1.5px] px-3 py-1.5',
        'text-xs font-semibold outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        active
          ? 'border-transparent'
          : 'border-border bg-(--ssz-bg-surface) text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {children}
      {count === undefined ? null : (
        <span
          style={active ? { background: colour, color: 'var(--ssz-bg-surface)' } : undefined}
          className={cn(
            'rounded-full px-1.5 text-[11px] font-bold leading-4',
            active ? '' : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
