const WIDTH = 56;
const HEIGHT = 20;
const BAR_WIDTH = 5;
const BAR_GAP = 2;
const MAX_BARS = 7;

type SparklineProps = {
  data: number[]; // 0–100, oldest→newest, up to 7 points
  emphasizeLast?: boolean;
  ariaLabel: string;
};

export function Sparkline({ data, emphasizeLast = true, ariaLabel }: SparklineProps) {
  const points = data.slice(-MAX_BARS);
  if (points.length === 0) return null;

  const max = Math.max(...points, 1);
  const totalBarWidth = BAR_WIDTH + BAR_GAP;
  const startX = WIDTH - points.length * totalBarWidth + BAR_GAP;

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-label={ariaLabel}
      role="img"
      className="shrink-0"
    >
      {points.map((value, i) => {
        const barHeight = Math.max(2, Math.round((value / max) * HEIGHT));
        const x = startX + i * totalBarWidth;
        const y = HEIGHT - barHeight;
        const isLast = i === points.length - 1;

        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={BAR_WIDTH}
            height={barHeight}
            rx={1}
            className={
              emphasizeLast && isLast
                ? 'fill-primary'
                : 'fill-neutral-300 dark:fill-neutral-600'
            }
          />
        );
      })}
    </svg>
  );
}
