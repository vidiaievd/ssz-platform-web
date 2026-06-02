type Props = { className?: string };

export function LanguagesIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Left book page */}
      <path
        d="M58 68 L10 60 L10 26 L58 32 Z"
        style={{
          fill: 'oklch(var(--ssz-primary-ch) / 0.12)',
          stroke: 'oklch(var(--ssz-primary-ch) / 0.40)',
        }}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Right book page */}
      <path
        d="M62 68 L110 60 L110 26 L62 32 Z"
        style={{
          fill: 'oklch(var(--ssz-primary-ch) / 0.12)',
          stroke: 'oklch(var(--ssz-primary-ch) / 0.40)',
        }}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Spine */}
      <path
        d="M58 32 Q60 50 62 68"
        style={{ stroke: 'oklch(var(--ssz-primary-ch) / 0.40)' }}
        strokeWidth="1.5"
      />
      {/* Text lines — left page */}
      <line x1="18" y1="42" x2="50" y2="44" style={{ stroke: 'oklch(var(--ssz-primary-ch) / 0.22)' }} strokeWidth="1" strokeLinecap="round" />
      <line x1="18" y1="49" x2="50" y2="51" style={{ stroke: 'oklch(var(--ssz-primary-ch) / 0.22)' }} strokeWidth="1" strokeLinecap="round" />
      <line x1="18" y1="56" x2="42" y2="58" style={{ stroke: 'oklch(var(--ssz-primary-ch) / 0.22)' }} strokeWidth="1" strokeLinecap="round" />
      {/* Text lines — right page */}
      <line x1="70" y1="44" x2="102" y2="42" style={{ stroke: 'oklch(var(--ssz-primary-ch) / 0.22)' }} strokeWidth="1" strokeLinecap="round" />
      <line x1="70" y1="51" x2="102" y2="49" style={{ stroke: 'oklch(var(--ssz-primary-ch) / 0.22)' }} strokeWidth="1" strokeLinecap="round" />
      {/* Speech bubble */}
      <rect
        x="58" y="3" width="54" height="22" rx="6"
        style={{
          fill: 'oklch(var(--ssz-primary-ch) / 0.18)',
          stroke: 'oklch(var(--ssz-primary-ch) / 0.50)',
        }}
        strokeWidth="1.5"
      />
      {/* Bubble tail */}
      <path
        d="M71 25 L65 34 L80 25"
        style={{
          fill: 'oklch(var(--ssz-primary-ch) / 0.18)',
          stroke: 'oklch(var(--ssz-primary-ch) / 0.50)',
        }}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Dots inside bubble */}
      <circle cx="75" cy="14" r="2.5" style={{ fill: 'oklch(var(--ssz-primary-ch) / 0.75)' }} />
      <circle cx="85" cy="14" r="2.5" style={{ fill: 'oklch(var(--ssz-primary-ch) / 0.75)' }} />
      <circle cx="95" cy="14" r="2.5" style={{ fill: 'oklch(var(--ssz-primary-ch) / 0.75)' }} />
    </svg>
  );
}
