type Props = { className?: string };

export function SchoolIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 120 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Building body */}
      <rect
        x="22" y="42" width="76" height="44" rx="2"
        style={{
          fill: 'oklch(var(--ssz-primary-ch) / 0.12)',
          stroke: 'oklch(var(--ssz-primary-ch) / 0.40)',
        }}
        strokeWidth="1.5"
      />
      {/* Roof */}
      <path
        d="M14 42 L60 14 L106 42 Z"
        style={{
          fill: 'oklch(var(--ssz-primary-ch) / 0.20)',
          stroke: 'oklch(var(--ssz-primary-ch) / 0.45)',
        }}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Door */}
      <rect
        x="48" y="63" width="24" height="23" rx="2"
        style={{
          fill: 'oklch(var(--ssz-primary-ch) / 0.25)',
          stroke: 'oklch(var(--ssz-primary-ch) / 0.40)',
        }}
        strokeWidth="1.5"
      />
      {/* Window left */}
      <rect
        x="30" y="50" width="18" height="13" rx="2"
        style={{
          fill: 'oklch(var(--ssz-primary-ch) / 0.30)',
          stroke: 'oklch(var(--ssz-primary-ch) / 0.40)',
        }}
        strokeWidth="1.5"
      />
      {/* Window right */}
      <rect
        x="72" y="50" width="18" height="13" rx="2"
        style={{
          fill: 'oklch(var(--ssz-primary-ch) / 0.30)',
          stroke: 'oklch(var(--ssz-primary-ch) / 0.40)',
        }}
        strokeWidth="1.5"
      />
      {/* Person left — head */}
      <circle
        cx="9" cy="35" r="6"
        style={{
          fill: 'oklch(var(--ssz-primary-ch) / 0.22)',
          stroke: 'oklch(var(--ssz-primary-ch) / 0.50)',
        }}
        strokeWidth="1.5"
      />
      {/* Person left — body */}
      <path
        d="M9 41 L9 54 M5 47 L13 47"
        style={{ stroke: 'oklch(var(--ssz-primary-ch) / 0.50)' }}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Person right — head */}
      <circle
        cx="111" cy="35" r="6"
        style={{
          fill: 'oklch(var(--ssz-primary-ch) / 0.22)',
          stroke: 'oklch(var(--ssz-primary-ch) / 0.50)',
        }}
        strokeWidth="1.5"
      />
      {/* Person right — body */}
      <path
        d="M111 41 L111 54 M107 47 L115 47"
        style={{ stroke: 'oklch(var(--ssz-primary-ch) / 0.50)' }}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
