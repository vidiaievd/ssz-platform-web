export interface PositionScaleProps {
  /** This learner's share of the taught course, whole percent. */
  own: number;
  /** The group's median of the same number, whole percent. */
  median: number;
  /** The word printed over the median tick — the only label the scale carries. */
  medianLabel: string;
  /** What the dot is, for a reader who cannot see it. */
  ownLabel: string;
}

/**
 * "Against the group" — one line with a tick and a dot, and no second chart.
 *
 * A scale rather than a ranking on purpose: the tick is the group's median and the dot is
 * this learner, so the reader sees a distance rather than a place in a queue. No
 * classmate is drawn, named or counted here — the sentence under the scale is the only
 * place a count is allowed, and even there it stays a count.
 */
export function PositionScale({ own, median, medianLabel, ownLabel }: PositionScaleProps) {
  return (
    <div
      className="relative mt-1.5 h-[46px]"
      role="img"
      aria-label={`${ownLabel} ${own}% · ${medianLabel} ${median}%`}
    >
      <div
        className="absolute top-5 right-0 left-0 h-2 rounded-full"
        style={{
          background: 'linear-gradient(90deg, var(--ssz-bg-muted), var(--ssz-bg-subtle))',
        }}
      />
      <div
        className="absolute top-2.5 h-7 w-0.5 bg-(--ssz-text-muted)"
        style={{ left: `${clamp(median)}%` }}
        aria-hidden
      />
      <div
        className="absolute top-0 -translate-x-1/2 text-[10.5px] font-bold text-(--ssz-text-muted)"
        style={{ left: `${clamp(median)}%` }}
        aria-hidden
      >
        {medianLabel}
      </div>
      <div
        className="absolute top-[15px] h-[18px] w-[18px] -translate-x-1/2 rounded-full border-[2.5px] border-(--ssz-bg-surface) shadow-(--ssz-shadow-sm)"
        style={{ left: `${clamp(own)}%`, background: 'oklch(var(--ssz-primary-ch))' }}
        aria-hidden
      />
    </div>
  );
}

const clamp = (percent: number): number => Math.max(0, Math.min(100, percent));
