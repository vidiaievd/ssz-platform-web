import { Award, CheckCircle, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { ProgressCanDo, ProgressCanDoState } from '@/features/learning/types';
import { DualMasteryBar } from './dual-mastery-bar';

const SUCCESS = 'var(--ssz-color-success-500)';
const ACCENT  = 'var(--ssz-color-primary-500)';
const AMBER   = 'var(--ssz-color-secondary-500)';

function stateColor(state: ProgressCanDoState): string {
  if (state === 'mastered') return SUCCESS;
  if (state === 'in-progress') return ACCENT;
  return AMBER;
}

function StateBadge({ state, pct }: { state: ProgressCanDoState; pct?: number }) {
  const t = useTranslations('Progress.canDo');
  const clr = stateColor(state);

  const styles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: `color-mix(in oklch, ${clr} 12%, transparent)`,
    color: clr,
    border: `1px solid color-mix(in oklch, ${clr} 25%, transparent)`,
  };

  if (state === 'mastered')
    return (
      <span style={styles}>
        <Award size={10} aria-hidden="true" />
        {t('mastered')}
      </span>
    );
  if (state === 'completed')
    return <span style={styles}>{t('completed')}</span>;

  return (
    <span style={styles}>
      {t('inProgress', { pct: pct ?? 0 })}
    </span>
  );
}

export interface ProgressCanDoItemProps {
  item: ProgressCanDo;
}

export function ProgressCanDoItem({ item }: ProgressCanDoItemProps) {
  const inProg  = item.state === 'in-progress';
  const mastered = item.state === 'mastered';
  const hue     = stateColor(item.state);
  const IconEl  = mastered ? Award : inProg ? Target : CheckCircle;

  return (
    <li
      style={{
        display: 'flex',
        gap: 14,
        padding: '14px 16px',
        borderRadius: 12,
        background: 'var(--ssz-bg-surface)',
        border: `1.5px solid ${inProg ? `color-mix(in oklch, ${ACCENT} 40%, transparent)` : 'var(--ssz-border-default)'}`,
        boxShadow: inProg ? 'var(--ssz-shadow-sm)' : 'var(--ssz-shadow-xs)',
        listStyle: 'none',
      }}
    >
      {/* icon circle */}
      <div
        aria-hidden="true"
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          flexShrink: 0,
          background: `color-mix(in oklch, ${hue} 11%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconEl size={20} color={hue} aria-hidden="true" />
      </div>

      {/* body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            color: 'var(--ssz-text-primary)',
            lineHeight: 1.35,
          }}
        >
          &ldquo;{item.text}&rdquo;
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 6,
            flexWrap: 'wrap',
          }}
        >
          {(item.skill || item.module) && (
            <span style={{ fontSize: 11.5, color: 'var(--ssz-text-muted)' }}>
              {[item.skill, item.module].filter(Boolean).join(' · ')}
            </span>
          )}
          <StateBadge state={item.state} pct={item.pct} />
        </div>
      </div>

      {/* right slot */}
      <div style={{ textAlign: 'right', flexShrink: 0, alignSelf: 'center' }}>
        {item.date ? (
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ssz-text-secondary)' }}>
            {item.date}
          </div>
        ) : (
          <div style={{ width: 90 }}>
            <DualMasteryBar completed={item.pct ?? 0} mastered={item.pct ?? 0} height={6} showMarker={false} />
          </div>
        )}
      </div>
    </li>
  );
}
