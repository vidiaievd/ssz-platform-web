import { useTranslations } from 'next-intl';

const ACCENT = 'var(--ssz-color-primary-500)';

export function CompletedMasteredLegend() {
  const t = useTranslations('Progress.legend');

  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
      {(
        [
          { solid: false, labelKey: 'completed' as const, descKey: 'completedDesc' as const },
          { solid: true,  labelKey: 'mastered'  as const, descKey: 'masteredDesc'  as const },
        ] as const
      ).map(({ solid, labelKey, descKey }) => (
        <div key={labelKey} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            aria-hidden="true"
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              flexShrink: 0,
              background: solid
                ? ACCENT
                : `color-mix(in oklch, ${ACCENT} 22%, transparent)`,
              border: solid ? 'none' : `1.5px solid color-mix(in oklch, ${ACCENT} 33%, transparent)`,
            }}
          />
          <span style={{ fontSize: 12.5, color: 'var(--ssz-text-secondary)' }}>
            <strong style={{ color: 'var(--ssz-text-primary)' }}>{t(labelKey)}</strong>
            {' · '}
            {t(descKey)}
          </span>
        </div>
      ))}
    </div>
  );
}
