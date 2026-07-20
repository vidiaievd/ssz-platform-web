/**
 * Per-language accent colour, derived from the same lightness/chroma curve
 * as the `primary` design-token scale (see `src/styles/globals.css`), with
 * the hue swapped per language. `c` and `deep` are the gradient start/end
 * used by `ResumeHero`; `soft`/`mid` are for chips and light fills.
 */
export interface LangHueTokens {
  c: string;
  soft: string;
  mid: string;
  deep: string;
}

const LANGUAGE_HUES: Record<string, number> = {
  no: 200,
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
    soft: `oklch(0.93 0.05 ${hue})`,
    mid: `oklch(0.79 0.09 ${hue})`,
    c: `oklch(0.62 0.105 ${hue})`,
    deep: `oklch(0.44 0.09 ${hue})`,
  };
}
