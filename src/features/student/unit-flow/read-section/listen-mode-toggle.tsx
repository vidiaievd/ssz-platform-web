'use client';

import { BookOpen, Headphones } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import type { ListenMode } from './read-section-types';

const MODES = [
  { id: 'read' as const,         icon: BookOpen,    labelKey: 'read'       as const },
  { id: 'listen-text' as const,  icon: Headphones,  labelKey: 'listenText' as const },
  { id: 'listen-only' as const,  icon: Headphones,  labelKey: 'audioOnly'  as const },
];

export interface ListenModeToggleProps {
  mode: ListenMode;
  hasAudio: boolean;
  onChange: (mode: ListenMode) => void;
}

export function ListenModeToggle({ mode, hasAudio, onChange }: ListenModeToggleProps) {
  const t = useTranslations('Learning.readSection.listenMode');

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="inline-flex gap-0.5 rounded-xl border p-0.5"
      style={{
        background: 'var(--ssz-bg-subtle)',
        borderColor: 'var(--ssz-border-default)',
      }}
    >
      {MODES.map((m) => {
        const active   = mode === m.id;
        const disabled = !hasAudio && m.id !== 'read';
        const Icon     = m.icon;

        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => { if (!disabled) onChange(m.id); }}
            className={cn(
              'flex items-center gap-1.5 rounded-[9px] border border-transparent px-3 py-1.5',
              'text-[13px] whitespace-nowrap transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
              active
                ? 'bg-surface font-bold shadow-sm text-(--ssz-color-primary-700)'
                : 'font-medium text-(--ssz-text-secondary)',
              disabled && 'cursor-not-allowed opacity-40',
            )}
            style={{ transitionDuration: 'var(--ssz-duration-base)', transitionTimingFunction: 'var(--ssz-ease-out)' }}
          >
            <Icon
              size={13}
              aria-hidden="true"
              style={{ color: active ? 'var(--ssz-color-primary-500)' : 'currentColor' }}
            />
            {t(m.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
