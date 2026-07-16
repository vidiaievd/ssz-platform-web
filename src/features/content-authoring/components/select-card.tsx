'use client';

import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

interface SelectCardProps {
  selected: boolean;
  icon: React.FC<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
  badge?: string;
  disabled?: boolean;
  disabledNote?: string;
}

/** Radio-card option used by the create-course Levels/Starter steps. */
export function SelectCard({
  selected,
  icon: Icon,
  title,
  description,
  onClick,
  badge,
  disabled,
  disabledNote,
}: SelectCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'relative flex w-full items-start gap-3.5 rounded-(--ssz-radius-lg) border-2 p-4 text-left transition-colors duration-(--ssz-duration-base)',
        disabled
          ? 'cursor-not-allowed opacity-60 border-(--ssz-border-default) bg-surface'
          : 'hover:bg-subtle',
        !disabled && selected
          ? 'border-(--ssz-color-primary-600) bg-(--ssz-color-primary-50) dark:bg-(--ssz-color-primary-950)'
          : !disabled && 'border-(--ssz-border-default) bg-surface',
      )}
    >
      {selected && !disabled && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-(--ssz-color-primary-600) text-white">
          <ChevronRight className="h-3 w-3" aria-hidden />
        </span>
      )}
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-(--ssz-radius-md)',
          !disabled && selected
            ? 'bg-(--ssz-color-primary-100) text-(--ssz-color-primary-700)'
            : 'bg-subtle text-(--ssz-text-secondary)',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm text-(--ssz-text-primary)">{title}</p>
          {badge && (
            <span className="rounded-full bg-(--ssz-color-primary-100) px-2 py-0.5 text-[10px] font-medium text-(--ssz-color-primary-700)">
              {badge}
            </span>
          )}
          {disabled && disabledNote && (
            <span className="rounded-full bg-(--ssz-bg-subtle) px-2 py-0.5 text-[10px] font-medium text-(--ssz-text-muted)">
              {disabledNote}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-(--ssz-text-secondary) leading-relaxed">{description}</p>
      </div>
    </button>
  );
}
