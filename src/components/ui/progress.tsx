import * as React from "react";
import { cn, clamp } from "@/lib/utils";

/* ── ProgressBar ─────────────────────────────────
   Horizontal bar with SSZ primary color.
─────────────────────────────────────────────── */
interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100 */
  value: number;
  /** Bar height in px, default 6 */
  height?: number;
  /** Override the fill color */
  color?: string;
  /** Show percentage label on the right */
  showLabel?: boolean;
}

const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, value, height = 6, color, showLabel = false, ...props }, ref) => {
    const pct = clamp(value, 0, 100);
    const fill = color ?? "oklch(0.62 0.105 168)";

    return (
      <div ref={ref} className={cn("flex items-center gap-3", className)} {...props}>
        <div
          className="flex-1 overflow-hidden rounded-full bg-neutral-200"
          style={{ height }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-[width] duration-slow ease-out-ssz"
            style={{ width: `${pct}%`, background: fill }}
          />
        </div>
        {showLabel && (
          <span className="text-xs font-semibold text-[var(--ssz-text-muted)] tabular-nums w-8 text-right shrink-0">
            {pct}%
          </span>
        )}
      </div>
    );
  }
);
ProgressBar.displayName = "ProgressBar";

/* ── ProgressRing ────────────────────────────────
   SVG donut ring — used on course cards.
─────────────────────────────────────────────── */
interface ProgressRingProps extends React.SVGAttributes<SVGSVGElement> {
  /** 0–100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  /** Label rendered in the center (default: percentage) */
  label?: React.ReactNode;
  showLabel?: boolean;
}

const ProgressRing = ({
  className,
  value,
  size = 64,
  strokeWidth = 5,
  color,
  label,
  showLabel = false,
  ...props
}: ProgressRingProps) => {
  const pct = clamp(value, 0, 100);
  const fill = color ?? "oklch(0.62 0.105 168)";
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const center = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={cn("-rotate-90", className)}
        aria-hidden
        {...props}
      >
        {/* Track */}
        <circle
          cx={center} cy={center} r={r}
          stroke="oklch(0.90 0.010 80)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Fill */}
        <circle
          cx={center} cy={center} r={r}
          stroke={fill}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-slow ease-out-ssz"
        />
      </svg>
      {showLabel && (
        <span
          className="absolute text-xs font-bold tabular-nums"
          style={{ color: fill, fontSize: size * 0.2 }}
        >
          {label ?? `${pct}%`}
        </span>
      )}
    </div>
  );
};

export { ProgressBar, ProgressRing };
