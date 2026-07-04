import { Award, CheckCircle, Clock, Layers, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { ProgressModule, ProgressModuleStatus } from '@/features/learning/types';
import { DualMasteryBar } from './dual-mastery-bar';
import type { MasteryMode } from './progress-mastery-skill-card';

const SUCCESS = 'var(--ssz-color-success-500)';
const ACCENT  = 'var(--ssz-color-primary-500)';

type ModuleLabelKey = 'mastered' | 'completed' | 'inProgress' | 'locked';

const STATUS_META: Record<
  ProgressModuleStatus,
  { labelKey: ModuleLabelKey; Icon: typeof Layers; badgeColor: string }
> = {
  mastered:  { labelKey: 'mastered',    Icon: Award,        badgeColor: SUCCESS },
  completed: { labelKey: 'completed',   Icon: CheckCircle,  badgeColor: 'var(--ssz-text-muted)' },
  active:    { labelKey: 'inProgress',  Icon: Clock,        badgeColor: ACCENT },
  locked:    { labelKey: 'locked',      Icon: Lock,         badgeColor: 'var(--ssz-text-muted)' },
};

export interface ProgressModuleRowProps {
  module: ProgressModule;
  mode: MasteryMode;
}

export function ProgressModuleRow({ module: m, mode }: ProgressModuleRowProps) {
  const t = useTranslations('Progress.modules');
  const meta   = STATUS_META[m.status];
  const locked = m.status === 'locked';
  const barColor = m.status === 'mastered' ? SUCCESS : ACCENT;

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: `color-mix(in oklch, ${meta.badgeColor} 12%, transparent)`,
    color: meta.badgeColor,
    border: `1px solid color-mix(in oklch, ${meta.badgeColor} 25%, transparent)`,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 16px',
        borderRadius: 12,
        background: 'var(--ssz-bg-surface)',
        border: '1.5px solid var(--ssz-border-default)',
        boxShadow: 'var(--ssz-shadow-xs)',
        opacity: locked ? 0.6 : 1,
      }}
    >
      {/* icon */}
      <div
        aria-hidden="true"
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          flexShrink: 0,
          background: 'var(--ssz-bg-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {locked ? (
          <Lock size={17} color="var(--ssz-text-muted)" aria-hidden="true" />
        ) : (
          <Layers size={17} color="var(--ssz-text-muted)" aria-hidden="true" />
        )}
      </div>

      {/* content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ssz-text-primary)',
            marginBottom: locked ? 0 : 8,
          }}
        >
          {m.title}
        </div>
        {!locked && (
          <DualMasteryBar
            completed={m.completed}
            mastered={m.mastered}
            color={barColor}
            height={8}
            showMarker={mode === 'overlay'}
          />
        )}
      </div>

      {/* right stats + badge */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}
      >
        {!locked && (
          <div style={{ textAlign: 'right', minWidth: 64 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ssz-text-primary)' }}>
              {m.mastered}%{' '}
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ssz-text-muted)' }}>
                {t('mastered')}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ssz-text-muted)' }}>
              {m.completed}% {t('completed')}
            </div>
          </div>
        )}
        <span style={badgeStyle}>
          <meta.Icon size={10} aria-hidden="true" />
          {t(meta.labelKey)}
        </span>
      </div>
    </div>
  );
}
