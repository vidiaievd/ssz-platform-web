'use client';

import type { CSSProperties } from 'react';

import type { CellState } from '@/lib/shared-kernel/analytics';
import { cn } from '@/lib/utils';

import { HATCH_WARN, PA, ramp, rampInk } from '../lib/ramp';

export interface HeatCellData {
  state: CellState;
  /** Whole percent, exactly as the service rounded it. `null` whenever unmeasured. */
  value: number | null;
  /** Evidence behind the cell, for the tooltip the caller composes. */
  weightedSample?: number;
}

export interface HeatCellProps {
  cell: HeatCellData;
  width?: number;
  height?: number;
  onClick?: () => void;
  /** Full sentence for the title attribute — who, which unit, what state, how much. */
  tip?: string;
  label?: string;
}

/**
 * One cell of any heat grid — the single place where a state becomes a shape.
 *
 * Every grid on the platform uses this rather than colouring cells itself, because the
 * six states have to look the same everywhere: a teacher learns the vocabulary once, on
 * the group's map, and reads it again on a learner's grid without relearning it.
 *
 * A measured zero is a solid cell printed `0`. An unattempted cell is a dashed outline
 * with nothing in it. They are never the same pixel.
 */
export function HeatCell({ cell, width = 34, height = 26, onClick, tip, label }: HeatCellProps) {
  const { style, glyph } = paint(cell);
  const interactive = onClick !== undefined;

  const content = (
    <span
      className={cn(
        'grid h-full w-full place-items-center rounded-[5px] text-[10.5px] font-bold',
        'box-border transition-transform duration-100',
        interactive && 'hover:z-10 hover:scale-[1.08] hover:shadow-(--ssz-shadow-md)',
      )}
      style={style}
    >
      {glyph}
    </span>
  );

  if (!interactive) {
    return (
      <span className="inline-block" style={{ width, height }} title={tip} aria-label={label}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={tip}
      aria-label={label ?? tip}
      className="inline-block cursor-pointer rounded-[5px] focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus) focus-visible:outline-none"
      style={{ width, height }}
    >
      {content}
    </button>
  );
}

/** What each state looks like — COMPONENTS §1, value for value. */
function paint(cell: HeatCellData): { style: CSSProperties; glyph: string } {
  switch (cell.state) {
    case 'ok':
    case 'low': {
      // `value` cannot be null here: the kernel never answers `ok`/`low` without one.
      const value = cell.value ?? 0;
      return {
        style: { background: ramp(value), color: rampInk(value), border: '1px solid transparent' },
        glyph: String(value),
      };
    }

    case 'notStarted':
      return {
        style: {
          background: 'var(--ssz-bg-surface)',
          border: '1.5px dashed var(--ssz-border-strong)',
          color: 'var(--ssz-text-muted)',
        },
        glyph: '',
      };

    case 'insufficient':
      return {
        style: {
          background: HATCH_WARN,
          border: `1px solid ${PA.warnLine}`,
          color: PA.warnInk,
        },
        glyph: '?',
      };

    case 'unlinked':
      return {
        style: {
          background: 'transparent',
          border: '1.5px dotted var(--ssz-border-strong)',
          borderTop: 'none',
          borderBottom: 'none',
          color: 'var(--ssz-text-muted)',
        },
        glyph: '⋮',
      };

    case 'noContent':
      // A statement about the course, not about the learner — solid and grey, with a
      // dash rather than a blank so that it reads as "there is nothing here to do"
      // instead of as a cell that failed to load.
      return {
        style: {
          background: 'var(--ssz-bg-subtle)',
          border: '1px solid transparent',
          color: 'var(--ssz-text-muted)',
          opacity: 0.65,
        },
        glyph: '—',
      };

    case 'notDelivered':
    default:
      return {
        style: {
          background: 'var(--ssz-bg-subtle)',
          border: '1px solid transparent',
          color: 'var(--ssz-text-muted)',
          opacity: 0.6,
        },
        glyph: '',
      };
  }
}
