import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface StatProps {
  label: string;
  /** Already formatted — a count, or an age in words. */
  value: ReactNode;
  /** What the figure is measured against: the promise, the period, the scope. */
  sub?: ReactNode;
  /**
   * A colour for the value, and only ever one from the age scale. Red here says "this
   * time is long", never "this school is failing" (`BEHAVIOR.md` §C).
   */
  tone?: string;
  className?: string;
}

/**
 * One number of the summary, with what it is measured against underneath.
 *
 * The caption is not decoration. "30" over "longer than promised" is a fact; "30" alone is
 * an accusation the reader completes themselves. Every figure on this screen carries the
 * scale it was counted on — the school's promise, the chosen period — because the same
 * number means different things under a 24-hour promise and a 72-hour one.
 */
export function Stat({ label, value, sub, tone, className }: StatProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
        {label}
      </div>
      <div
        className="mt-1 text-[26px] font-bold leading-none tracking-[-0.02em]"
        style={tone === undefined ? undefined : { color: tone }}
      >
        {value}
      </div>
      {sub === undefined ? null : (
        <div className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}
