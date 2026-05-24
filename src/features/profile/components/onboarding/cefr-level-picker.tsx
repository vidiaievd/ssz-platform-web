'use client';

import { useRef } from 'react';

import { cn } from '@/lib/utils';
import type { CEFRLevel } from '../../stores/onboarding-store';
import { CEFR_LEVELS } from '../../stores/onboarding-store';

type CEFRLevelPickerProps = {
  value: CEFRLevel | '';
  onChange: (level: CEFRLevel) => void;
  disabled?: boolean;
  id?: string;
};

export function CEFRLevelPicker({ value, onChange, disabled, id }: CEFRLevelPickerProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(e: React.KeyboardEvent, level: CEFRLevel) {
    const idx = CEFR_LEVELS.indexOf(level);
    let nextIdx = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIdx = Math.min(idx + 1, CEFR_LEVELS.length - 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIdx = Math.max(idx - 1, 0);
    } else {
      return;
    }
    if (nextIdx !== idx) {
      e.preventDefault();
      const next = CEFR_LEVELS[nextIdx];
      if (next) onChange(next);
      const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('button');
      buttons?.[nextIdx]?.focus();
    }
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      id={id}
      aria-label="CEFR level"
      className="flex gap-1"
    >
      {CEFR_LEVELS.map((level) => {
        const checked = value === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            tabIndex={checked || (!value && level === 'A1') ? 0 : -1}
            onClick={() => onChange(level)}
            onKeyDown={(e) => handleKeyDown(e, level)}
            className={cn(
              'flex h-8 w-10 items-center justify-center rounded-md border text-xs font-semibold',
              'transition-colors duration-(--ssz-duration-base)',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              checked
                ? 'border-(--ssz-color-primary-600) bg-(--ssz-color-primary-600) text-white'
                : 'border-(--ssz-border-base) bg-(--ssz-bg-base) text-(--ssz-text-secondary) hover:bg-(--ssz-bg-subtle)',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {level}
          </button>
        );
      })}
    </div>
  );
}
