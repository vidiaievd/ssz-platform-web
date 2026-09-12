import type { CSSProperties } from 'react';

export type StatTone = 'primary' | 'warn' | 'danger' | 'neutral';

export interface StatProps {
  label: string;
  /** Already a string: `—` is a legal value and means "we do not know". */
  value: string;
  sub?: string;
  tone?: StatTone;
  hint?: string;
}

// Only the number is coloured, never the label beside it: the tone is a reading of the
// figure, and tinting the whole block would turn a summary into an alarm.
const TONE: Record<StatTone, CSSProperties['color']> = {
  primary: 'oklch(var(--ssz-primary-ch))',
  warn: 'oklch(var(--ssz-secondary-ch))',
  danger: 'var(--destructive)',
  neutral: 'var(--ssz-text-primary)',
};

/**
 * One number of a summary.
 *
 * `value` is a string on purpose, so that a caller with nothing to report passes `—`
 * rather than `0`. Every summary in this package has at least one figure that is
 * routinely unknown, and formatting it as a number would make the dash unreachable.
 */
export function Stat({ label, value, sub, tone = 'neutral', hint }: StatProps) {
  return (
    <div className="min-w-0" title={hint}>
      <div className="mb-[5px] text-[11px] font-bold tracking-[0.05em] text-(--ssz-text-muted) uppercase">
        {label}
      </div>
      <div
        className="text-[26px] leading-[1.05] font-bold tracking-[-0.03em]"
        style={{ color: TONE[tone] ?? TONE.neutral }}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-1 text-xs leading-[1.4] text-(--ssz-text-secondary)">{sub}</div>
      ) : null}
    </div>
  );
}
