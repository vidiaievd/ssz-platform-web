'use client';

import { X, Zap, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { RunnerMode } from './types';

interface ExTopBarProps {
  mode: RunnerMode;
  idx: number;
  total: number;
  unitLabel: string;
  accent: string;
  onExit?: () => void;
}

/** Fixed top bar: exit button, mode identity badge, set progress counter + underline. */
export function ExTopBar({ mode, idx, total, unitLabel, accent, onExit }: ExTopBarProps) {
  const t = useTranslations('ExerciseRunner');
  const isGraded = mode === 'graded';

  const softColor = isGraded
    ? 'var(--ssz-color-secondary-100)'
    : 'var(--ssz-color-primary-50)';

  const ModeIcon = isGraded ? Target : Zap;

  return (
    <header
      className="flex-shrink-0"
      style={{
        background: 'var(--ssz-bg-surface)',
        borderBottom: '1px solid var(--ssz-border-default)',
      }}
    >
      <div
        className="mx-auto flex w-full items-center justify-between px-5"
        style={{ height: 60, maxWidth: 760 }}
      >
        <button
          aria-label={t('exit')}
          onClick={onExit}
          className="flex items-center justify-center"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: '1.5px solid var(--ssz-border-default)',
            background: 'var(--ssz-bg-surface)',
            cursor: 'pointer',
            color: 'var(--ssz-text-secondary)',
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="flex items-center gap-[9px]">
          <span
            className="flex items-center justify-center"
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: softColor,
            }}
          >
            <ModeIcon size={15} style={{ color: accent }} aria-hidden="true" />
          </span>
          <div className="flex flex-col" style={{ lineHeight: 1.15 }}>
            <span
              className="font-bold"
              style={{ fontSize: 14.5, color: 'var(--ssz-text-primary)' }}
            >
              {isGraded ? t('graded') : t('practice')}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--ssz-text-muted)' }}>
              {unitLabel}
            </span>
          </div>
        </div>

        <div
          className="min-w-[38px] text-right text-[12.5px] font-semibold"
          style={{ color: 'var(--ssz-text-muted)' }}
        >
          {idx + 1}/{total}
        </div>
      </div>

      {/* Progress underline */}
      <div style={{ height: 3, background: 'var(--ssz-border-default)' }}>
        <div
          style={{
            height: '100%',
            width: `${(idx / total) * 100}%`,
            background: accent,
            transition: 'width var(--ssz-duration-slower) var(--ssz-ease-out)',
          }}
        />
      </div>
    </header>
  );
}
