/**
 * The hatch patterns every grid on the page shares. Render once per page.
 *
 * Hatching is how "we cannot judge this" is drawn, and it has to be a pattern rather
 * than a colour: the distinction between an unjudgeable cell and a bad one must survive
 * a greyscale print and a colour-blind reader.
 */
export function PaDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <pattern
          id="paHatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="6" height="6" fill="var(--ssz-bg-subtle)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ssz-border-strong)" strokeWidth="2" />
        </pattern>
        <pattern
          id="paHatchWarn"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="6" height="6" fill="oklch(var(--ssz-secondary-ch) / 0.18)" />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="6"
            stroke="oklch(var(--ssz-secondary-ch))"
            strokeWidth="1.6"
          />
        </pattern>
      </defs>
    </svg>
  );
}
