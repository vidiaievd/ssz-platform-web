'use client';

import type { CellState } from '@/lib/shared-kernel/analytics';

import { ramp } from '../lib/ramp';

export interface ChartUnit {
  unitId: string;
  no: number;
  title: string;
}

export interface ChartDelivered {
  /** 1 taught in full, 0.5 begun, 0 not at all. `null` — the timetable was not asked. */
  value: 0 | 0.5 | 1 | null;
}

export interface ChartAbsorbed {
  state: CellState;
  /** Whole percent, as the service rounded it. */
  median: number | null;
  p25: number | null;
  p75: number | null;
}

export interface DeliveredAbsorbedProps {
  units: readonly ChartUnit[];
  /** By index of `units`. */
  delivered: readonly ChartDelivered[];
  absorbed: readonly ChartAbsorbed[];
  /** Whole percent per unit id, `null` where nothing was attempted. */
  quality: Record<string, number | null>;
  showQuality?: boolean;
  picked?: number | null;
  onPick?: (index: number) => void;
  height?: number;
  ariaLabel?: string;
}

const W = 920;
const PL = 44;
const PR = 14;
const PT = 16;

/**
 * What was taught against what was taken away, per unit — the chart of screen A.
 *
 * The single most important thing it does is **break the absorbed line** wherever there
 * is no judgeable value. A continuous line drawn through a unit nobody attempted invents
 * a number for it, and the whole package exists to stop that: a gap in the line is the
 * honest drawing of a gap in the data, and the column behind it is marked with its own
 * reason (hatched for unlinked, grey for never taught).
 */
export function DeliveredAbsorbed({
  units,
  delivered,
  absorbed,
  quality,
  showQuality = true,
  picked = null,
  onPick,
  height = 300,
  ariaLabel = 'Delivered versus absorbed, per course unit',
}: DeliveredAbsorbedProps) {
  const H = height;
  const PB = showQuality ? 62 : 34;
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;
  const step = units.length === 0 ? plotW : plotW / units.length;

  const cx = (index: number) => PL + step * (index + 0.5);
  /** `share` is 0..1; the percent values are divided once, at the call site. */
  const y = (share: number) => PT + plotH * (1 - share);
  const yPct = (percent: number) => y(percent / 100);

  // The delivered step: a unit not yet asked about (`null`) simply contributes no step,
  // which leaves a gap rather than dropping the line to the floor.
  let dPath = '';
  let penDown = false;
  delivered.forEach((unit, index) => {
    if (unit.value === null) {
      penDown = false;
      return;
    }
    const x0 = PL + step * index;
    const x1 = PL + step * (index + 1);
    const yy = y(unit.value);
    dPath += `${penDown ? 'L' : 'M'}${x0},${yy}L${x1},${yy}`;
    penDown = true;
  });

  // Absorbed: contiguous runs only. A point joins the run when it is measured and has a
  // median; anything else ends the run.
  const runs: Array<Array<{ index: number; median: number; p25: number; p75: number }>> = [];
  let run: Array<{ index: number; median: number; p25: number; p75: number }> = [];
  absorbed.forEach((unit, index) => {
    if (unit.state === 'ok' && unit.median !== null) {
      run.push({
        index,
        median: unit.median,
        p25: unit.p25 ?? unit.median,
        p75: unit.p75 ?? unit.median,
      });
      return;
    }
    if (run.length > 0) runs.push(run);
    run = [];
  });
  if (run.length > 0) runs.push(run);

  const line = (points: typeof run) =>
    points.map((p, k) => `${k === 0 ? 'M' : 'L'}${cx(p.index)},${yPct(p.median)}`).join('');

  const band = (points: typeof run) =>
    points.map((p) => `${cx(p.index)},${yPct(p.p75)}`).join(' ') +
    ' ' +
    points
      .slice()
      .reverse()
      .map((p) => `${cx(p.index)},${yPct(p.p25)}`)
      .join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full min-w-[660px]"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <pattern
            id="paGap"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="7" height="7" fill="var(--ssz-bg-subtle)" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--ssz-border-strong)" strokeWidth="2" />
          </pattern>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line
              x1={PL}
              x2={W - PR}
              y1={y(g)}
              y2={y(g)}
              stroke="var(--ssz-border-default)"
              strokeWidth="1"
              strokeDasharray={g === 0 || g === 1 ? '' : '3 4'}
            />
            <text
              x={PL - 9}
              y={y(g) + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--ssz-text-muted)"
              fontWeight="600"
            >
              {g * 100}%
            </text>
          </g>
        ))}

        {/* Columns nobody can be judged in, marked as regions — never as a zero. */}
        {units.map((unit, index) => {
          const state = absorbed[index]?.state;
          if (state === 'unlinked') {
            return (
              <rect
                key={unit.unitId}
                x={PL + step * index}
                y={PT}
                width={step}
                height={plotH}
                fill="url(#paGap)"
                opacity="0.55"
              />
            );
          }
          if (state === 'notDelivered') {
            return (
              <rect
                key={unit.unitId}
                x={PL + step * index}
                y={PT}
                width={step}
                height={plotH}
                fill="var(--ssz-bg-subtle)"
                opacity="0.5"
              />
            );
          }
          return null;
        })}

        {picked !== null && (
          <rect
            x={PL + step * picked}
            y={PT}
            width={step}
            height={plotH}
            fill="oklch(var(--ssz-primary-ch) / 0.16)"
          />
        )}

        {runs.map((points, k) => (
          <polygon
            key={`band-${k}`}
            points={band(points)}
            fill="oklch(var(--ssz-primary-ch))"
            opacity="0.16"
          />
        ))}
        {runs.map((points, k) => (
          <path
            key={`line-${k}`}
            d={line(points)}
            fill="none"
            stroke="oklch(var(--ssz-primary-ch))"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        <path
          d={dPath}
          fill="none"
          stroke="var(--ssz-text-primary)"
          strokeWidth="2"
          strokeDasharray="7 4"
          strokeLinejoin="round"
          opacity="0.75"
        />

        {absorbed.map((unit, index) => {
          if (unit.state === 'ok' && unit.median !== null) {
            return (
              <circle
                key={units[index]?.unitId ?? index}
                cx={cx(index)}
                cy={yPct(unit.median)}
                r="4"
                fill="var(--ssz-bg-surface)"
                stroke="oklch(var(--ssz-primary-ch))"
                strokeWidth="2.4"
              />
            );
          }
          if (unit.state === 'insufficient') {
            // Parked near the floor when there is no median at all — marked with a `?`,
            // so it reads as "we cannot say", not as a low score.
            const at = yPct(unit.median ?? 10);
            return (
              <g key={units[index]?.unitId ?? index}>
                <circle
                  cx={cx(index)}
                  cy={at}
                  r="7"
                  fill="oklch(var(--ssz-secondary-ch) / 0.18)"
                  stroke="oklch(var(--ssz-secondary-ch))"
                  strokeWidth="1.6"
                  strokeDasharray="2.5 2.5"
                />
                <text
                  x={cx(index)}
                  y={at + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="800"
                  fill="var(--ssz-text-primary)"
                >
                  ?
                </text>
              </g>
            );
          }
          return null;
        })}

        {units.map((unit, index) => (
          <g
            key={unit.unitId}
            onClick={onPick ? () => onPick(index) : undefined}
            style={{ cursor: onPick ? 'pointer' : 'default' }}
          >
            <rect x={PL + step * index} y={PT} width={step} height={plotH + 22} fill="transparent">
              <title>{`${unit.no}. ${unit.title}`}</title>
            </rect>
            <text
              x={cx(index)}
              y={PT + plotH + 17}
              textAnchor="middle"
              fontSize="11"
              fontWeight={picked === index ? 800 : 600}
              fill={picked === index ? 'oklch(var(--ssz-primary-ch))' : 'var(--ssz-text-secondary)'}
            >
              {unit.no}
            </text>
          </g>
        ))}

        {showQuality &&
          units.map((unit, index) => {
            const q = quality[unit.unitId] ?? null;
            const yq = PT + plotH + 28;
            return q === null ? (
              <rect
                key={unit.unitId}
                x={PL + step * index + 3}
                y={yq}
                width={step - 6}
                height={12}
                rx="3"
                fill="url(#paGap)"
                opacity="0.6"
              />
            ) : (
              <rect
                key={unit.unitId}
                x={PL + step * index + 3}
                y={yq}
                width={step - 6}
                height={12}
                rx="3"
                fill={ramp(q)}
              />
            );
          })}
      </svg>
    </div>
  );
}
