import { useTranslations } from 'next-intl';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { SrsHeatmapDay } from '../../types';

function intensityClass(count: number): string {
  if (count === 0) return 'bg-[var(--ssz-bg-muted)]';
  if (count <= 3) return 'bg-[var(--ssz-color-primary-100)]';
  if (count <= 8) return 'bg-[var(--ssz-color-primary-300)]';
  return 'bg-[var(--ssz-color-primary-500)]';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

interface HeatmapProps {
  days: SrsHeatmapDay[];
}

export function Heatmap({ days }: HeatmapProps) {
  const t = useTranslations('Srs.stats');

  return (
    <div
      className="flex flex-wrap gap-1"
      role="img"
      aria-label={t('last30')}
    >
      {days.map((day) => (
        <Tooltip key={day.date}>
          <TooltipTrigger asChild>
            <div
              className={`h-4 w-4 rounded-[var(--ssz-radius-xs,2px)] cursor-default transition-opacity hover:opacity-80 ${intensityClass(day.count)}`}
              aria-label={t('heatCell', { count: day.count, date: formatDate(day.date) })}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              {t('heatCell', { count: day.count, date: formatDate(day.date) })}
            </p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
