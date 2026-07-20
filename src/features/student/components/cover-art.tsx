/** Language-hued striped cover art for course cards and detail pages. */

const LANG_HUE: Record<string, number> = {
  nb: 200, no: 200,
  es: 28,
  uk: 82,
  fr: 300,
  de: 145,
  ja: 15,
  en: 250,
  ru: 0,
};

const LANG_ENDONYM: Record<string, string> = {
  nb: 'Norsk',   no: 'Norsk',
  es: 'Español',
  uk: 'Українська',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  en: 'English',
  ru: 'Русский',
};

function hueOf(lang: string) {
  return LANG_HUE[lang.toLowerCase()] ?? 200;
}
function hueSoft(h: number) { return `oklch(0.95 0.03 ${h})`; }
function hueMid(h: number)  { return `oklch(0.70 0.10 ${h})`; }
function hueDeep(h: number) { return `oklch(0.42 0.09 ${h})`; }

export interface CoverArtProps {
  langCode: string;
  level: string;
  /** Height in px — 132 for cards, 168 for detail hero */
  height?: number;
  /** Border radius in px */
  borderRadius?: number;
}

export function CoverArt({ langCode, level, height = 132, borderRadius = 12 }: CoverArtProps) {
  const code = langCode.toLowerCase();
  const hue = hueOf(code);
  const patId = `cover-stripe-${code}-${level}`;
  const endonym = LANG_ENDONYM[code] ?? langCode.toUpperCase();
  const soft = hueSoft(hue);
  const mid = hueMid(hue);
  const deep = hueDeep(hue);

  return (
    <div
      aria-hidden="true"
      className="relative shrink-0 overflow-hidden"
      style={{
        height,
        borderRadius,
        background: soft,
        border: `1px solid ${mid}33`,
      }}
    >
      {/* diagonal stripe pattern */}
      <svg
        width="100%"
        height="100%"
        className="absolute inset-0 block"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id={patId}
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="14" height="14" fill="none" />
            <line x1="0" y1="0" x2="0" y2="14" stroke={mid} strokeOpacity="0.22" strokeWidth="6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patId})`} />
      </svg>

      {/* language endonym tag — bottom-left */}
      <span
        className="absolute bottom-2.5 left-2.5 rounded-md px-1.75 py-0.75 font-mono text-[10.5px] leading-none tracking-[0.04em] bg-surface"
        style={{ color: deep, border: `1px solid ${mid}44` }}
      >
        {endonym}
      </span>

      {/* CEFR level badge — top-right */}
      <span
        className="absolute top-2.5 right-2.5 rounded-md px-2 py-0.75 font-mono text-[11px] leading-none font-bold tracking-[0.02em] text-white"
        style={{ background: deep }}
      >
        {level}
      </span>
    </div>
  );
}
