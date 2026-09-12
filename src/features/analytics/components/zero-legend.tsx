import type { CellState } from '@/lib/shared-kernel/analytics';
import { cn } from '@/lib/utils';

import { HATCH_WARN, PA, ramp } from '../lib/ramp';

/** The gradient itself is an item of the legend, alongside the shapes. */
export type LegendKey = CellState | 'scale';

export interface LegendItem {
  key: LegendKey;
  label: string;
  /** Longer explanation, shown on hover. */
  hint?: string;
}

export interface ZeroLegendProps {
  items: LegendItem[];
  compact?: boolean;
}

/**
 * The legend of the five kinds of zero — required beside every grid.
 *
 * Not optional and not collapsible: the shapes are deliberately quiet, and a reader who
 * has not been told what a dashed outline means will read it as a bad result. The brief
 * is explicit that a grid without this legend must not ship.
 */
export function ZeroLegend({ items, compact = false }: ZeroLegendProps) {
  return (
    <ul
      className={cn(
        'flex list-none flex-wrap items-center',
        compact ? 'gap-x-4 gap-y-1.5' : 'gap-x-5 gap-y-2',
      )}
    >
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-[7px]" title={item.hint}>
          <Swatch state={item.key} />
          <span className="text-[11.5px] font-semibold text-(--ssz-text-secondary)">
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Swatch({ state }: { state: LegendKey }) {
  const base = 'h-4 w-5 shrink-0 box-border rounded-[4px]';

  switch (state) {
    case 'scale':
      return (
        <span
          className={cn(base, 'w-12')}
          style={{ background: `linear-gradient(90deg, ${ramp(0)}, ${ramp(50)}, ${ramp(100)})` }}
          aria-hidden
        />
      );

    case 'notStarted':
      return (
        <span
          className={base}
          style={{
            background: 'var(--ssz-bg-surface)',
            border: '1.5px dashed var(--ssz-border-strong)',
          }}
          aria-hidden
        />
      );

    case 'insufficient':
      return (
        <span
          className={base}
          style={{ background: HATCH_WARN, border: `1px solid ${PA.warnLine}` }}
          aria-hidden
        />
      );

    case 'unlinked':
      return (
        <span
          className={cn(base, 'rounded-none')}
          style={{
            border: '1.5px dotted var(--ssz-border-strong)',
            borderTop: 'none',
            borderBottom: 'none',
          }}
          aria-hidden
        />
      );

    case 'noContent':
      return (
        <span
          className={base}
          style={{ background: 'var(--ssz-bg-subtle)', opacity: 0.65 }}
          aria-hidden
        />
      );

    default:
      return (
        <span
          className={base}
          style={{ background: 'var(--ssz-bg-subtle)', opacity: 0.7 }}
          aria-hidden
        />
      );
  }
}
