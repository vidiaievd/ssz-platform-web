/**
 * Solid tile color per language, mirroring the hue family the timetable grid
 * already uses for its lesson blocks (`timetable-grid.tsx` `LANG_STYLES`) so a
 * language reads as the same color everywhere in Groups. The hi-fi spec ties
 * each language to a fixed hue (README "Language hues") — this is that mapping
 * expressed in Tailwind's solid 500 step rather than raw oklch.
 */
const LANG_TILE_COLOR: Record<string, string> = {
  nb: 'bg-blue-500',
  no: 'bg-blue-500',
  en: 'bg-amber-500',
  uk: 'bg-sky-500',
  ru: 'bg-rose-500',
  de: 'bg-emerald-500',
  fr: 'bg-violet-500',
};

const DEFAULT_TILE_COLOR = 'bg-primary-500';

export function langTileColor(lang: string): string {
  return LANG_TILE_COLOR[lang.toLowerCase()] ?? DEFAULT_TILE_COLOR;
}
