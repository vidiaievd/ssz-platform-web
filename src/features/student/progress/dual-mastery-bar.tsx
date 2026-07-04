'use client';

/**
 * Dual-layer mastery bar: a light "completed" fill behind a solid "mastered" fill.
 * Used in the B8 Progress dashboard; distinct from the single-value MasteryBar in
 * features/learning/components which drives skill-tier colour logic.
 */
export interface DualMasteryBarProps {
  /** 0–100: "did it" */
  completed: number;
  /** 0–100: "retained it" — always ≤ completed */
  mastered: number;
  color?: string;
  height?: number;
  /** Show the vertical marker line at the mastery boundary */
  showMarker?: boolean;
  className?: string;
}

export function DualMasteryBar({
  completed,
  mastered,
  color = 'var(--ssz-color-primary-500)',
  height = 10,
  showMarker = true,
}: DualMasteryBarProps) {
  const c = Math.min(100, Math.max(0, completed));
  const m = Math.min(c, Math.max(0, mastered));

  return (
    <div
      role="progressbar"
      aria-valuenow={m}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Mastered"
      style={{
        position: 'relative',
        height,
        borderRadius: 999,
        background: 'var(--ssz-bg-muted)',
        overflow: 'visible',
      }}
    >
      {/* completed layer (light) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: `${c}%`,
          borderRadius: 999,
          background: `color-mix(in oklch, ${color} 22%, transparent)`,
          transition: 'width 0.7s cubic-bezier(0.16,1,0.3,1)',
        }}
      />
      {/* mastered layer (solid) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: `${m}%`,
          borderRadius: 999,
          background: color,
          transition: 'width 0.7s cubic-bezier(0.16,1,0.3,1)',
        }}
      />
      {/* boundary marker */}
      {showMarker && m > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -3,
            bottom: -3,
            left: `${m}%`,
            width: 2,
            background: 'var(--ssz-bg-surface)',
            boxShadow: `0 0 0 1.5px ${color}`,
            borderRadius: 2,
            transform: 'translateX(-1px)',
            transition: 'left 0.7s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      )}
    </div>
  );
}
