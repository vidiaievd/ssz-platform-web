'use client';

import { ChevronRight, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export interface TrainingTileData {
  id: string;
  icon: LucideIcon;
  /** Raw hue angle (0-360), independent of langHue — training tiles aren't language-scoped. */
  hue: number;
  label: string;
  description: string;
  /** Items ready to practise; omitted in the `lg` (featured) variant. */
  ready?: number;
  /** Short meta line pinned to the bottom, e.g. "~15 min · adaptive". */
  meta?: string;
  disabled?: boolean;
}

export interface TrainingTileProps {
  tile: TrainingTileData;
  size?: 'md' | 'lg';
  onOpen?: (tile: TrainingTileData) => void;
  className?: string;
}

/** Practice-type tile used on the training hub, in both compact and featured sizes. */
export function TrainingTile({ tile, size = 'md', onOpen, className }: TrainingTileProps) {
  const t = useTranslations('Student.homeCards.trainingTile');
  const big = size === 'lg';
  const Icon = tile.icon;

  const hue = {
    c: `oklch(0.62 0.105 ${tile.hue})`,
    soft: `oklch(0.955 0.028 ${tile.hue})`,
    deep: `oklch(0.42 0.09 ${tile.hue})`,
  };

  return (
    <button
      type="button"
      disabled={tile.disabled}
      onClick={() => onOpen?.(tile)}
      style={{ '--hue-c': hue.c, '--hue-soft': hue.soft, '--hue-deep': hue.deep } as React.CSSProperties}
      className={cn(
        'group flex h-full flex-col rounded-md border-[1.5px] border-(--ssz-border-default) bg-surface text-left',
        'shadow-(--ssz-shadow-xs) transition-[border-color,box-shadow,transform] duration-base ease-out-ssz',
        'hover:-translate-y-0.5 hover:border-(--hue-c) hover:shadow-(--ssz-shadow-md)',
        'disabled:pointer-events-none disabled:opacity-40',
        big ? 'gap-2.5 p-4.5' : 'gap-2 p-3.5',
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-md bg-(--hue-soft)',
            big ? 'size-10' : 'size-8.5',
          )}
        >
          <Icon size={big ? 21 : 18} className="text-(--hue-deep)" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'font-bold tracking-[-0.01em] text-(--ssz-text-primary)',
              big ? 'text-[15px]' : 'text-sm',
            )}
          >
            {tile.label}
          </div>
          {tile.ready != null && !big && (
            <div className="mt-0.25 text-[11px] text-(--ssz-text-muted)">
              {t('ready', { count: tile.ready })}
            </div>
          )}
        </div>
        <ChevronRight
          size={16}
          className="text-(--hue-c) opacity-0 transition-opacity duration-base group-hover:opacity-100"
          aria-hidden="true"
        />
      </div>
      <p className={cn('text-(--ssz-text-secondary)', big ? 'text-[13px] leading-relaxed' : 'text-xs leading-relaxed')}>
        {tile.description}
      </p>
      {tile.meta && (
        <div className="mt-auto text-[11.5px] font-semibold text-(--hue-deep)">{tile.meta}</div>
      )}
    </button>
  );
}
