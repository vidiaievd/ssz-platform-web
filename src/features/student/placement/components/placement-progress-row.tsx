'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { PLACEMENT_LEVELS, PLACEMENT_QUESTION_COUNT } from '../adaptive';
import type { PlacementDirection, PlacementLevelId } from '../types';

/* ── design tokens ──────────────────────────────────────────────────────────── */
const PRIMARY = 'var(--ssz-color-primary-500)';
const BORDER  = 'var(--ssz-border-default)';
const SUCCESS_700 = 'var(--ssz-color-success-700)';
const SUCCESS_BG  = 'var(--ssz-color-success-50)';
const SUCCESS_BD  = 'var(--ssz-color-success-200)';

/* ── sub-components ─────────────────────────────────────────────────────────── */

interface DotsProps {
  total: number;
  current: number; // 0-based index of the current question
}

function QuestionDots({ total, current }: DotsProps) {
  const t = useTranslations('Placement.runner');

  return (
    <div className="flex items-center gap-[10px]">
      <div className="flex items-center gap-[6px]" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const isDone   = i < current;
          const isActive = i === current;
          return (
            <div
              key={i}
              style={{
                height: 6,
                width: isActive ? 22 : 8,
                borderRadius: 999,
                background: isDone || isActive ? PRIMARY : BORDER,
                opacity: isDone ? 0.55 : isActive ? 1 : 0.5,
                transition: 'width 260ms var(--ssz-ease-out), opacity 260ms var(--ssz-ease-out)',
              }}
            />
          );
        })}
      </div>
      <span
        className="text-[12px] font-semibold"
        style={{ color: 'var(--ssz-text-muted)', letterSpacing: '0.01em' }}
        aria-live="polite"
      >
        {t('progressCount', { current: current + 1, total })}
      </span>
    </div>
  );
}

interface DirectionChipProps {
  direction: PlacementDirection;
}

function DirectionChip({ direction }: DirectionChipProps) {
  const t = useTranslations('Placement.runner');
  if (!direction) return null;

  const isUp = direction === 'up';
  const Icon = isUp ? ChevronUp : ChevronDown;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px 2px 6px',
        borderRadius: 999,
        background: isUp ? SUCCESS_BG : 'var(--ssz-bg-subtle)',
        border: `1px solid ${isUp ? SUCCESS_BD : BORDER}`,
        fontSize: 11.5,
        fontWeight: 600,
        color: isUp ? SUCCESS_700 : 'var(--ssz-text-secondary)',
      }}
    >
      <Icon size={12} aria-hidden="true" />
      {isUp ? t('steppingUp') : t('easingBack')}
    </span>
  );
}

interface LevelMeterProps {
  levels: readonly PlacementLevelId[];
  activeLevelIndex: number;
  lastDirection: PlacementDirection;
  questionNumber: number;
}

function LevelMeter({ levels, activeLevelIndex, lastDirection, questionNumber }: LevelMeterProps) {
  const t = useTranslations('Placement.runner');
  const showChip = questionNumber > 0; // no chip before first answer

  return (
    <div>
      <div className="mb-[6px] flex items-center gap-[8px]">
        <span
          className="text-[11px] font-bold uppercase"
          style={{ letterSpacing: '0.06em', color: 'var(--ssz-text-muted)' }}
        >
          {t('levelLabel')}
        </span>
        {showChip && <DirectionChip direction={lastDirection} />}
      </div>
      <div className="flex items-end gap-[6px]">
        {levels.map((levelId, i) => {
          const isPassed = i < activeLevelIndex;
          const isActive = i === activeLevelIndex;
          return (
            <div key={levelId} className="flex flex-col items-center gap-[4px]">
              <div
                style={{
                  height: 6,
                  width: 32,
                  borderRadius: 999,
                  background: isActive || isPassed ? PRIMARY : 'var(--ssz-bg-muted)',
                  opacity: isPassed ? 0.4 : 1,
                  transition: 'all 300ms var(--ssz-ease-inout)',
                }}
                aria-hidden="true"
              />
              <span
                className="text-[10.5px]"
                style={{
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--ssz-text-primary)' : 'var(--ssz-text-muted)',
                  letterSpacing: '0.02em',
                }}
              >
                {levelId}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── public component ────────────────────────────────────────────────────────── */

export interface PlacementProgressRowProps {
  questionNumber: number;
  activeLevelIndex: number;
  lastDirection: PlacementDirection;
}

export function PlacementProgressRow({
  questionNumber,
  activeLevelIndex,
  lastDirection,
}: PlacementProgressRowProps) {
  return (
    <div className="flex flex-col gap-[10px]">
      <QuestionDots total={PLACEMENT_QUESTION_COUNT} current={questionNumber} />
      <LevelMeter
        levels={PLACEMENT_LEVELS}
        activeLevelIndex={activeLevelIndex}
        lastDirection={lastDirection}
        questionNumber={questionNumber}
      />
    </div>
  );
}
