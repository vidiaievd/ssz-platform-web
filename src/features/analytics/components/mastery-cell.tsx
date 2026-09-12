import type { CSSProperties, ReactNode } from 'react';

import type { CellState } from '@/lib/shared-kernel/analytics';

import { HATCH_WARN, PA, ramp, rampInk } from '../lib/ramp';

export interface MasteryCellData {
  state: CellState;
  /** Whole percent, exactly as the service rounded it. `null` whenever unmeasured. */
  ewma: number | null;
  /** Days a right answer survives, as the profile measured it. */
  meanStability: number | null;
  weightedSample: number;
}

export interface MasteryCellLabels {
  /** Said on a cell the course has nothing behind — a fact about the course. */
  noItems: string;
  /** Said on a cell the learner has never touched — a fact about the learner. */
  notStarted: string;
  /** `{days}d stable`, under the number. */
  stable: (days: number) => string;
  /** `{sample}/{threshold}`, under the question mark. */
  shortfall: (sample: number, threshold: number) => string;
}

export interface MasteryCellProps {
  cell: MasteryCellData | undefined;
  minWeightedSample: number;
  labels: MasteryCellLabels;
  /** The whole sentence for the title attribute, composed by the caller. */
  tip?: string;
}

/**
 * One `skill × focus` cell of a learner's grid — taller than a heat cell, because it
 * carries two numbers instead of one.
 *
 * Deliberately not `HeatCell` with a bigger box: the second line is what makes this grid
 * worth drawing. `62%` alone cannot tell a teacher whether to review sooner or to teach
 * the thing again, and `11d stable` beside it can. The three unmeasured states say their
 * kind in words rather than leaving a coloured blank to be guessed at.
 */
export function MasteryCell({ cell, minWeightedSample, labels, tip }: MasteryCellProps) {
  const { style, primary, secondary } = paint(cell, minWeightedSample, labels);

  return (
    <div
      title={tip}
      className="box-border grid h-[52px] place-items-center gap-px rounded-[9px] p-1 text-center"
      style={style}
    >
      {primary}
      {secondary}
    </div>
  );
}

function paint(
  cell: MasteryCellData | undefined,
  minWeightedSample: number,
  labels: MasteryCellLabels,
): { style: CSSProperties; primary: ReactNode; secondary: ReactNode } {
  const word = (text: string) => (
    <div className="text-[11px] font-semibold text-(--ssz-text-muted)">{text}</div>
  );

  const state: CellState = cell?.state ?? 'noContent';

  switch (state) {
    case 'noContent':
    case 'notDelivered':
    case 'unlinked':
      // Grey and worded: the course has no items on this pair, so there is nothing to
      // measure and nothing the learner could have done about it.
      return {
        style: { background: 'var(--ssz-bg-subtle)', opacity: 0.6 },
        primary: word(labels.noItems),
        secondary: null,
      };

    case 'notStarted':
      return {
        style: {
          background: 'var(--ssz-bg-surface)',
          border: '1.5px dashed var(--ssz-border-strong)',
        },
        primary: word(labels.notStarted),
        secondary: null,
      };

    case 'insufficient':
      return {
        style: { background: HATCH_WARN, border: `1px solid ${PA.warnLine}`, color: PA.warnInk },
        primary: <div className="text-sm font-extrabold">?</div>,
        secondary: (
          <div className="text-[10px] font-bold">
            {labels.shortfall(round(cell?.weightedSample ?? 0), minWeightedSample)}
          </div>
        ),
      };

    default: {
      // `ok` and `low` are the measured half of the scale, and the kernel never answers
      // either without a value.
      const value = cell?.ewma ?? 0;
      const stability = cell?.meanStability ?? null;
      return {
        style: { background: ramp(value), color: rampInk(value) },
        primary: <div className="text-[15px] font-extrabold tracking-[-0.02em]">{`${value}%`}</div>,
        secondary:
          stability === null ? null : (
            <div className="text-[9.5px] font-semibold opacity-85">
              {labels.stable(round(stability))}
            </div>
          ),
      };
    }
  }
}

const round = (value: number): number => Math.round(value * 10) / 10;
