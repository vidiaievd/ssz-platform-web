'use client';

import { useTranslations } from 'next-intl';

import { CATALOG_TABS, type CatalogTab } from '@/features/student/schemas/catalog-filters';
import { cn } from '@/lib/utils';

export interface AccessTabsProps {
  active: CatalogTab;
  counts: Record<CatalogTab, number>;
  onChange: (tab: CatalogTab) => void;
}

/** Access tabs (All / Free / By subscription / From my schools) with a live count chip and hint line. */
export function AccessTabs({ active, counts, onChange }: AccessTabsProps) {
  const t = useTranslations('Catalog.tabs');
  const tHint = useTranslations('Catalog.tabHints');

  return (
    <div className="mb-5">
      <div role="tablist" aria-label={t('all')} className="flex flex-wrap gap-2">
        {CATALOG_TABS.map((tab) => {
          const isActive = tab === active;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border-[1.5px] px-3.5 py-1.75 text-[13px] font-bold',
                'transition-colors duration-base ease-out-ssz',
                isActive
                  ? 'border-(--ssz-color-primary-500) bg-[oklch(0.93_0.05_168)] text-(--ssz-color-primary-700)'
                  : 'border-(--ssz-border-default) bg-surface text-(--ssz-text-secondary) hover:border-(--ssz-border-strong)',
              )}
            >
              {t(tab)}
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.25 text-[11px] font-bold',
                  isActive
                    ? 'bg-white/70 text-(--ssz-color-primary-700)'
                    : 'bg-(--ssz-bg-subtle) text-(--ssz-text-muted)',
                )}
              >
                {counts[tab]}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-[12.5px] text-(--ssz-text-muted)">{tHint(active)}</p>
    </div>
  );
}
