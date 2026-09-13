'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import { isMeasured } from '@/lib/shared-kernel/analytics';

import { HeatCell } from './heat-cell';
import type { HeatmapRow } from '../types';

export type HeatmapSort = 'roster' | 'lowest';

export interface HeatmapUnit {
  unitId: string;
  no: number;
  title: string;
}

export interface HeatmapProps {
  units: readonly HeatmapUnit[];
  rows: readonly HeatmapRow[];
  /** The whole tooltip sentence, composed by the caller so every word is translatable. */
  tip: (row: HeatmapRow, unit: HeatmapUnit, index: number) => string;
  /** When this learner was last seen, already formatted. `null` prints nothing. */
  lastSeen?: (row: HeatmapRow) => string | null;
  /** Where a measured cell leads. Returning `null` makes the cell inert. */
  href?: (row: HeatmapRow, unit: HeatmapUnit) => string | null;
  sort?: HeatmapSort;
  /** Told when a cell is opened, so the screen can record which kinds of emptiness matter. */
  onOpen?: (row: HeatmapRow, unit: HeatmapUnit, index: number) => void;
  labels: { student: string; empty: string; grid: string };
}

const CELL_W = 34;
const CELL_H = 26;
const COL_W = 42;

/**
 * Every learner of a group against every unit of its course — screen B.
 *
 * It exists because the median on the chart above hides the person who is drowning, so
 * the one thing it must not do is hide them a second way. Nobody is dropped for having no
 * data: a learner who has done nothing gets a full row of named emptiness, which is how a
 * teacher tells "joined last week" from "stopped in July".
 *
 * The name column is frozen and only the unit columns scroll: thirty units is about 1300
 * pixels, and a teacher scrolling sideways must never lose track of whose row they are on.
 */
export function Heatmap({
  units,
  rows,
  tip,
  href,
  lastSeen,
  sort = 'roster',
  onOpen,
  labels,
}: HeatmapProps) {
  const ordered = useMemo(() => order(rows, sort), [rows, sort]);
  const { cellProps, gridProps } = useGridKeys(ordered.length, units.length);

  if (rows.length === 0 || units.length === 0) {
    return <p className="text-sm text-(--ssz-text-secondary)">{labels.empty}</p>;
  }

  return (
    <div className="flex overflow-hidden rounded-xl border border-(--ssz-border-default) bg-(--ssz-bg-surface)">
      {/* Frozen name column */}
      <div className="shrink-0 border-r border-(--ssz-border-default) bg-(--ssz-bg-surface)">
        <div className="flex h-[34px] items-end px-3 pb-1.5 text-[10px] font-bold tracking-[0.05em] text-(--ssz-text-muted) uppercase">
          {labels.student}
        </div>
        {ordered.map((row) => (
          <div
            key={row.studentId}
            className="flex h-[38px] flex-col justify-center border-t border-(--ssz-border-default) px-3"
          >
            <span className="max-w-[170px] truncate text-[12.5px] leading-tight font-semibold text-(--ssz-text-primary)">
              {row.displayName}
            </span>
            {/* A row of dashed outlines means one of two very different things, and only
                this date tells them apart: stopped in July, or joined last week. */}
            {lastSeen ? (
              <span className="max-w-[170px] truncate text-[10px] leading-tight text-(--ssz-text-muted)">
                {lastSeen(row) ?? ''}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Scrolling unit columns */}
      <div className="flex-1 overflow-x-auto">
        <div
          style={{ minWidth: units.length * COL_W }}
          role="grid"
          aria-label={labels.grid}
          {...gridProps}
        >
          <div
            className="grid h-[34px] items-end pb-1.5"
            style={{ gridTemplateColumns: `repeat(${units.length}, minmax(${COL_W}px, 1fr))` }}
          >
            {units.map((unit) => (
              <div
                key={unit.unitId}
                title={unit.title}
                className="text-center text-[11px] font-bold text-(--ssz-text-secondary)"
              >
                {unit.no}
              </div>
            ))}
          </div>

          {ordered.map((row, rowIndex) => (
            <div
              key={row.studentId}
              role="row"
              aria-label={row.displayName}
              className="grid h-[38px] items-center justify-items-center border-t border-(--ssz-border-default)"
              style={{ gridTemplateColumns: `repeat(${units.length}, minmax(${COL_W}px, 1fr))` }}
            >
              {units.map((unit, index) => {
                const cell = row.cells[index];
                if (!cell) return <span key={unit.unitId} role="gridcell" />;

                const to = href?.(row, unit) ?? null;
                const sentence = tip(row, unit, index);

                // The cell itself is the focusable thing, whether it leads anywhere or
                // not: a keyboard reader walking the map needs every cell announced,
                // including the empty ones — those are most of what this map says.
                return (
                  <div
                    key={unit.unitId}
                    role="gridcell"
                    aria-label={sentence}
                    title={sentence}
                    className="rounded-[5px] focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus) focus-visible:outline-none"
                    {...cellProps(rowIndex, index, () => {
                      if (to === null) return;
                      onOpen?.(row, unit, index);
                      window.location.assign(to);
                    })}
                  >
                    {to === null ? (
                      <HeatCell cell={cell} width={CELL_W} height={CELL_H} />
                    ) : (
                      // Still a link for a mouse and for anything that lists links, but
                      // out of the tab order: the cell around it is the one tab stop, and
                      // the arrows move between cells.
                      <a
                        href={to}
                        aria-label={sentence}
                        tabIndex={-1}
                        onClick={() => onOpen?.(row, unit, index)}
                      >
                        <HeatCell cell={cell} width={CELL_W} height={CELL_H} />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Roster order, or the people who are struggling first.
 *
 * Two decisions the prototype's sum of cells got wrong, and both are the same mistake
 * this whole package is about:
 *
 * A learner with **no measured cell at all** sums to zero and would lead the list — read
 * as the worst in the class, when the truth is that nobody knows anything about them.
 * They go last instead, in roster order, and their empty row says what it says.
 *
 * And the score is the **mean** of the measured cells rather than their sum: a learner
 * measured on two units at 80% must not rank below one measured on eight units at 50%,
 * which is what a sum does — it ranks by how much was attempted, not by how it went.
 */
function order(rows: readonly HeatmapRow[], sort: HeatmapSort): HeatmapRow[] {
  if (sort === 'roster') return [...rows];

  const scoreOf = (row: HeatmapRow): number | null => {
    const values = row.cells
      .filter((cell) => isMeasured(cell.state) && cell.value !== null)
      .map((cell) => cell.value as number);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  const scored = rows.map((row, index) => ({ row, index, score: scoreOf(row) }));

  return scored
    .sort((a, b) => {
      if (a.score === null && b.score === null) return a.index - b.index;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return a.score - b.score || a.index - b.index;
    })
    .map((entry) => entry.row);
}

/**
 * Arrow keys across the map, one tab stop for the whole of it.
 *
 * A grid of thirty units by fifteen learners is four hundred and fifty tab stops, which
 * is not navigation — it is a wall. The map takes a single stop and the arrows move
 * inside it, which is what `role="grid"` promises a screen-reader user it will do.
 */
function useGridKeys(rows: number, cols: number) {
  const [active, setActive] = useState<[number, number]>([0, 0]);
  const cells = useRef(new Map<string, HTMLDivElement>());

  const focus = useCallback((r: number, c: number) => {
    setActive([r, c]);
    cells.current.get(`${r}:${c}`)?.focus();
  }, []);

  const gridProps = {
    onKeyDown: (event: React.KeyboardEvent) => {
      const [r, c] = active;
      const moves: Record<string, [number, number] | undefined> = {
        ArrowRight: [r, Math.min(c + 1, cols - 1)],
        ArrowLeft: [r, Math.max(c - 1, 0)],
        ArrowDown: [Math.min(r + 1, rows - 1), c],
        ArrowUp: [Math.max(r - 1, 0), c],
        Home: [r, 0],
        End: [r, cols - 1],
      };
      const next = moves[event.key];
      if (!next) return;
      event.preventDefault();
      focus(next[0], next[1]);
    },
  };

  const cellProps = (r: number, c: number, open: () => void) => ({
    ref: (node: HTMLDivElement | null) => {
      if (node) cells.current.set(`${r}:${c}`, node);
      else cells.current.delete(`${r}:${c}`);
    },
    tabIndex: active[0] === r && active[1] === c ? 0 : -1,
    onFocus: () => setActive([r, c]),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      open();
    },
  });

  return { cellProps, gridProps };
}

/** A sort control the caller can render; kept here so the two stay in step. */
export function useHeatmapSort(initial: HeatmapSort = 'roster') {
  return useState<HeatmapSort>(initial);
}
