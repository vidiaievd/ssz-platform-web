import { BookOpen, Headphones, Layers, Pen } from 'lucide-react';
import type { ElementType } from 'react';
import { useTranslations } from 'next-intl';

import type { ProgressSkillId, ProgressSkillMastery } from '@/features/learning/types';
import { DualMasteryBar } from './dual-mastery-bar';

export type MasteryMode = 'overlay' | 'dual';

/* ── Skill color & icon mapping ─────────────────────────────────── */

const SKILL_COLOR: Record<ProgressSkillId, string> = {
  reading:   'var(--ssz-color-success-500)',
  listening: 'var(--ssz-color-secondary-500)',
  vocab:     'var(--ssz-color-primary-500)',
  grammar:   'var(--ssz-color-info-500)',
};

const SKILL_ICON: Record<ProgressSkillId, ElementType> = {
  reading:   BookOpen,
  listening: Headphones,
  vocab:     Layers,
  grammar:   Pen,
};

/* ── Component ──────────────────────────────────────────────────── */

export interface ProgressMasterySkillCardProps {
  skill: ProgressSkillMastery;
  mode: MasteryMode;
}

export function ProgressMasterySkillCard({ skill, mode }: ProgressMasterySkillCardProps) {
  const t = useTranslations('Progress.mastery');
  const color = SKILL_COLOR[skill.id] ?? 'var(--ssz-color-primary-500)';
  const Icon  = SKILL_ICON[skill.id] ?? Layers;
  const gap   = skill.completed - skill.mastered;

  return (
    <section
      aria-label={t('sectionLabel', { skill: skill.label })}
      style={{
        padding: '18px 20px',
        borderRadius: 13,
        background: 'var(--ssz-bg-surface)',
        border: '1.5px solid var(--ssz-border-default)',
        boxShadow: 'var(--ssz-shadow-xs)',
      }}
    >
      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `color-mix(in oklch, ${color} 11%, transparent)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={18} color={color} aria-hidden="true" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ssz-text-primary)' }}>
            {skill.label}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ssz-text-muted)' }}>
            {t('level', { level: skill.level })}
          </div>
        </div>
      </div>

      {mode === 'dual' ? (
        /* ── Mode B: two separate bars ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(
            [
              { labelKey: 'completed' as const, value: skill.completed, solid: false },
              { labelKey: 'mastered'  as const, value: skill.mastered,  solid: true  },
            ] as const
          ).map(({ labelKey, value, solid }) => (
            <div key={labelKey}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: 'var(--ssz-text-secondary)', fontWeight: 600 }}>
                  {t(labelKey)}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: solid ? color : 'var(--ssz-text-secondary)',
                  }}
                >
                  {value}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t(labelKey)}
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: 'var(--ssz-bg-muted)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${value}%`,
                    borderRadius: 999,
                    background: solid ? color : `color-mix(in oklch, ${color} 25%, transparent)`,
                    transition: 'width 0.7s cubic-bezier(0.16,1,0.3,1)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Mode A: overlay bar ── */
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 9 }}>
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color,
                letterSpacing: '-0.02em',
              }}
            >
              {skill.mastered}%
            </span>
            <span style={{ fontSize: 12, color: 'var(--ssz-text-muted)' }}>
              {t('masteredOf', { completed: skill.completed })}
            </span>
          </div>
          <DualMasteryBar
            completed={skill.completed}
            mastered={skill.mastered}
            color={color}
            height={11}
            showMarker
          />
          <p style={{ fontSize: 11.5, color: 'var(--ssz-text-muted)', marginTop: 9 }}>
            {gap > 0 ? t('gap', { gap }) : t('fullyRetained')}
          </p>
        </div>
      )}
    </section>
  );
}
