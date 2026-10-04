import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The runner's feedback colours, measured from the stylesheet itself in both themes.
 *
 * AC-R6 of the dictation handoff asks for 4.5:1 in both themes, and jsdom cannot measure it
 * (axe's colour-contrast rule needs layout). The pairs are fixed by design — a label always
 * sits on its own fill — so they can be measured where they are defined: here, from the
 * oklch values in `globals.css`, with the WCAG 2 ratio. A token retuned below AA fails this.
 */

const css = readFileSync(join(__dirname, 'globals.css'), 'utf8');

type Oklch = [number, number, number];

/** The token's value in the first `:root` block that sets it, or in the dark block. */
function token(name: string, theme: 'light' | 'dark'): Oklch {
  const dark = css.indexOf('.dark {');
  const scope = theme === 'dark' ? css.slice(dark) : css.slice(0, dark);
  const m = new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`).exec(scope);
  if (m === null) {
    // Not redefined for dark: the light value holds.
    if (theme === 'dark') return token(name, 'light');
    throw new Error(`--${name} not found`);
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function luminance([L, C, h]: Oklch): number {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (x: number) => Math.min(1, Math.max(0, x));
  const r = clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

function ratio(fg: string, bg: string, theme: 'light' | 'dark'): number {
  const x = luminance(token(fg, theme));
  const y = luminance(token(bg, theme));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Label on fill — every state of the corrected line, the verdict notes and «Fasit». */
const PAIRS: Array<[string, string]> = [
  ['ssz-feedback-ok-fg', 'ssz-feedback-ok-bg'],
  ['ssz-feedback-no-fg', 'ssz-feedback-no-bg'],
  ['ssz-feedback-near-fg', 'ssz-feedback-near-bg'],
  ['ssz-feedback-key-fg', 'ssz-feedback-key-bg'],
  ['ssz-feedback-key-strong', 'ssz-feedback-key-bg'],
  // The bold correction inside a wrong or near chip.
  ['ssz-feedback-ok-fg', 'ssz-feedback-no-bg'],
  ['ssz-feedback-ok-fg', 'ssz-feedback-near-bg'],
  // Small labels — «Rettet», the word counter, the attempt line.
  ['ssz-text-muted', 'ssz-bg-base'],
  ['ssz-text-muted', 'ssz-bg-surface'],
  ['ssz-text-muted', 'ssz-bg-subtle'],
];

describe('feedback colours (AC-R6)', () => {
  it.each(['light', 'dark'] as const)('reach 4.5:1 on their own fills, %s theme', (theme) => {
    for (const [fg, bg] of PAIRS) {
      expect({ pair: `${fg} on ${bg}`, ratio: ratio(fg, bg, theme) >= 4.5 }).toEqual({
        pair: `${fg} on ${bg}`,
        ratio: true,
      });
    }
  });

  it('turns the fills dark in the dark theme, not a light slab on a dark page', () => {
    for (const fill of ['ok', 'no', 'near', 'key']) {
      expect(luminance(token(`ssz-feedback-${fill}-bg`, 'dark'))).toBeLessThan(0.1);
    }
  });
});
