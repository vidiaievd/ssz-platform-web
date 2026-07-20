/**
 * Per-language accent colour, derived from the same lightness/chroma curve
 * as the `primary` design-token scale (see `src/styles/globals.css`), with
 * the hue swapped per language. `c` and `deep` are the gradient start/end
 * used by `ResumeHero`; `soft`/`mid` are for chips and light fills.
 *
 * `c`, `soft`, `mid` and `deep` resolve through `--ssz-lang-*-lc` CSS
 * variables, which carry a dark-theme override — they stay correct on both
 * a light card surface and a dark one without any JS theme detection.
 * `ink` is the one exception: it is not theme-reactive, for the one spot
 * (the ResumeHero CTA) where the text always sits on a fixed white chip
 * regardless of the active theme.
 */
export interface LangHueTokens {
  c: string;
  soft: string;
  mid: string;
  deep: string;
  ink: string;
}

const LANGUAGE_HUES: Record<string, number> = {
  nb: 200,
  es: 28,
  en: 200,
  fr: 300,
  de: 145,
  ja: 15,
  uk: 82,
};

const FALLBACK_HUE = LANGUAGE_HUES.en;

export function langHue(code: string): LangHueTokens {
  const hue = LANGUAGE_HUES[code.toLowerCase()] ?? FALLBACK_HUE;
  return {
    soft: `oklch(var(--ssz-lang-soft-lc) ${hue})`,
    mid: `oklch(var(--ssz-lang-mid-lc) ${hue})`,
    c: `oklch(var(--ssz-lang-c-lc) ${hue})`,
    deep: `oklch(var(--ssz-lang-deep-lc) ${hue})`,
    ink: `oklch(0.44 0.09 ${hue})`,
  };
}
