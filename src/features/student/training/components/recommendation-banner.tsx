'use client';

import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import type { ReviewKind } from '@/features/learning/types';

export interface RecommendationBannerProps {
  kind: ReviewKind;
  count: number;
  icon: LucideIcon;
  hue: number;
  onStart: () => void;
}

/** Amber-style callout for whichever practice type has the most ready items. */
export function RecommendationBanner({ kind, count, icon: Icon, hue, onStart }: RecommendationBannerProps) {
  const t = useTranslations('Student.trainingPage.recommended');

  const c = `oklch(var(--ssz-lang-c-lc) ${hue})`;
  const soft = `oklch(var(--ssz-lang-soft-lc) ${hue})`;
  const deep = `oklch(var(--ssz-lang-deep-lc) ${hue})`;

  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-3.5 rounded-lg border p-4"
      style={{ background: soft, borderColor: `color-mix(in oklch, ${c} 20%, transparent)` }}
    >
      <div
        className="flex size-9.5 shrink-0 items-center justify-center rounded-md border bg-surface"
        style={{ borderColor: `color-mix(in oklch, ${c} 20%, transparent)` }}
      >
        <Icon size={18} style={{ color: deep }} aria-hidden="true" />
      </div>
      <div className="min-w-45 flex-1">
        <div className="text-[10.5px] font-bold tracking-[0.06em] uppercase" style={{ color: deep }}>
          {t('overline')}
        </div>
        <div className="mt-0.5 text-[13.5px] font-semibold text-(--ssz-text-primary)">
          {t(kind, { count })}
        </div>
      </div>
      <Button size="sm" onClick={onStart}>
        {t('cta')}
      </Button>
    </div>
  );
}
