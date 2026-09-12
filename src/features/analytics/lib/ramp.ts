// The analytics visual language — plan 58, phase 6. Ported from the hi-fi prototype
// (`progress-hifi/pa-charts.jsx`) without changing a single value.
//
// One rule drives everything in this folder: a cell may never render as "0%" when the
// truth is "we do not know". Every kind of emptiness gets its own SHAPE, and colour is
// secondary — a reader who cannot distinguish hues still sees the difference.

/**
 * Percentages arrive from the service already rounded to whole numbers (§O9), and this
 * scale wants a share. Converted here, once, rather than at every call site: rounding a
 * rounded number is how two screens end up one percent apart.
 */
const shareOf = (percent: number): number => Math.max(0, Math.min(1, percent / 100));

/** Fill for anything that IS measured: amber at the bottom, green at the top. */
export function ramp(percent: number): string {
  const t = shareOf(percent);
  return `oklch(${0.92 - t * 0.26} ${0.06 + t * 0.07} ${28 + t * 120})`;
}

/** The number written inside a `ramp()` cell — same hue, dark enough to read on it. */
export function rampInk(percent: number): string {
  const t = shareOf(percent);
  return `oklch(${0.4 - t * 0.04} ${0.09 + t * 0.03} ${28 + t * 120})`;
}

/**
 * The prototype's `--gh-*` semantic tokens, mapped onto the ones this app already has.
 *
 * No token is added to the design system (COMPONENTS §4): `--gh-primary` is this app's
 * primary channel and `--gh-warn` its secondary (amber) one, both theme-aware through
 * the channel triples. The mapping lives here so that the components below read like the
 * prototype they were ported from.
 */
export const PA = {
  primary: 'oklch(var(--ssz-primary-ch))',
  primarySoft: 'oklch(var(--ssz-primary-ch) / 0.16)',
  warn: 'oklch(var(--ssz-secondary-ch))',
  warnSoft: 'oklch(var(--ssz-secondary-ch) / 0.18)',
  warnLine: 'oklch(var(--ssz-secondary-ch) / 0.55)',
  /** Text on a warn-tinted fill: the app's own primary ink, legible in both themes. */
  warnInk: 'var(--ssz-text-primary)',
} as const;

/** CSS equivalents of the SVG hatches, for cells that are DOM rather than SVG. */
export const HATCH =
  'repeating-linear-gradient(45deg, var(--ssz-bg-subtle) 0 4px, var(--ssz-border-default) 4px 6px)';

export const HATCH_WARN = `repeating-linear-gradient(45deg, ${PA.warnSoft} 0 4px, ${PA.warnLine} 4px 6px)`;
