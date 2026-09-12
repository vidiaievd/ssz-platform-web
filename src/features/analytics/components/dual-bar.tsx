import { HATCH } from '../lib/ramp';

export interface DualBarProps {
  /** Share of the plan taught, 0..1. `null` — the timetable could not be asked. */
  delivered: number | null;
  /** Whole percent absorbed. `null` — nothing measured, which is not zero. */
  absorbed: number | null;
  width?: number;
  label?: string;
}

/**
 * Two eight-pixel bars, taught above taken — the dashboard widget's whole chart.
 *
 * `absorbed === null` is drawn as hatching across the full width rather than as an empty
 * track: an empty track and a track filled to zero look alike at this size, and the two
 * mean opposite things. Same for a delivery nobody could ask about.
 */
export function DualBar({ delivered, absorbed, width = 150, label }: DualBarProps) {
  return (
    <div className="grid gap-1" style={{ width }} role="img" aria-label={label}>
      {delivered === null ? (
        <div className="h-2 rounded-full" style={{ background: HATCH }} />
      ) : (
        <div className="h-2 overflow-hidden rounded-full bg-(--ssz-bg-muted)">
          <div
            className="h-full rounded-full bg-(--ssz-text-primary) opacity-65"
            style={{ width: `${Math.max(0, Math.min(1, delivered)) * 100}%` }}
          />
        </div>
      )}

      {absorbed === null ? (
        <div className="h-2 rounded-full" style={{ background: HATCH }} />
      ) : (
        <div className="h-2 overflow-hidden rounded-full bg-(--ssz-bg-muted)">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(0, Math.min(100, absorbed))}%`,
              background: 'oklch(var(--ssz-primary-ch))',
            }}
          />
        </div>
      )}
    </div>
  );
}
