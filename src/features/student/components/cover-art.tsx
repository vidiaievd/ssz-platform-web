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
  const code  = langCode.toLowerCase();
  const hue   = hueOf(code);
  const patId = `cover-stripe-${code}-${level}`;
  const endonym = LANG_ENDONYM[code] ?? langCode.toUpperCase();

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'relative',
        height,
        borderRadius,
        overflow: 'hidden',
        background: hueSoft(hue),
        border: `1px solid ${hueMid(hue)}33`,
        flexShrink: 0,
      }}
    >
      {/* diagonal stripe pattern */}
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, display: 'block' }}
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
            <line
              x1="0" y1="0" x2="0" y2="14"
              stroke={hueMid(hue)}
              strokeOpacity="0.22"
              strokeWidth="6"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patId})`} />
      </svg>

      {/* language endonym tag — bottom-left */}
      <span
        style={{
          position: 'absolute',
          left: 10,
          bottom: 10,
          fontFamily: 'var(--ssz-font-mono)',
          fontSize: 10.5,
          letterSpacing: '0.04em',
          color: hueDeep(hue),
          background: 'var(--ssz-bg-surface)',
          padding: '3px 7px',
          borderRadius: 6,
          border: `1px solid ${hueMid(hue)}44`,
          lineHeight: 1,
        }}
      >
        {endonym}
      </span>

      {/* CEFR level badge — top-right */}
      <span
        style={{
          position: 'absolute',
          right: 10,
          top: 10,
          fontFamily: 'var(--ssz-font-mono)',
          fontSize: 11,
          fontWeight: 700,
          color: '#fff',
          background: hueDeep(hue),
          padding: '3px 8px',
          borderRadius: 6,
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        {level}
      </span>
    </div>
  );
}
