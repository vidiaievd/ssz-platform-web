import type { LucideIcon } from 'lucide-react';

export interface ProgressStatTileProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  sub?: string;
  color: string;
}

export function ProgressStatTile({ icon: Icon, value, label, sub, color }: ProgressStatTileProps) {
  return (
    <div
      role="group"
      aria-label={`${label}: ${value}`}
      style={{
        padding: '16px 18px',
        borderRadius: 13,
        background: 'var(--ssz-bg-surface)',
        border: '1.5px solid var(--ssz-border-default)',
        boxShadow: 'var(--ssz-shadow-xs)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon size={16} color={color} aria-hidden="true" />
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--ssz-text-muted)',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: 'var(--ssz-text-primary)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11.5, color, fontWeight: 600, marginTop: 5 }}>{sub}</div>
      )}
    </div>
  );
}
