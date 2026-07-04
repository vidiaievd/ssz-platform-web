'use client';

import { useEffect, useRef, useState } from 'react';

export interface RingProgressProps {
  /** 0–100 */
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sublabel?: string;
  /** aria-label for the SVG */
  ariaLabel?: string;
}

export function RingProgress({
  pct,
  size = 92,
  stroke = 9,
  color = 'var(--ssz-color-success-500)',
  label,
  sublabel,
  ariaLabel,
}: RingProgressProps) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  /* Animate from 0 on mount; do not re-animate on tab switch. */
  const [animated, setAnimated] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      requestAnimationFrame(() => setAnimated(true));
    }
  }, []);

  const dash = animated ? (Math.min(pct / 100, 1) * circ).toFixed(2) : '0';

  const reducedMotionStyle =
    '@media (prefers-reduced-motion: reduce) { .ring-arc { transition: none !important; } }';

  return (
    <div
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
      aria-label={ariaLabel ?? (label ? `${label} ${sublabel ?? ''}`.trim() : undefined)}
    >
      <style>{reducedMotionStyle}</style>
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)', display: 'block' }}
        aria-hidden="true"
      >
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ssz-border-default)"
          strokeWidth={stroke}
        />
        {/* fill arc */}
        <circle
          className="ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ.toFixed(2)}`}
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>

      {label !== undefined && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontSize: Math.round(size * 0.22),
              fontWeight: 700,
              color: 'var(--ssz-text-primary)',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {label}
          </span>
          {sublabel && (
            <span
              style={{
                fontSize: Math.round(size * 0.13),
                color: 'var(--ssz-text-muted)',
                marginTop: 2,
              }}
            >
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
