'use client';

import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { difficultyLevels } from '@/features/content/schemas';
import { useUrlFilters } from '@/lib/url-filters/use-url-filters';
import { cn } from '@/lib/utils';
import { catalogFiltersSchema, parseLevels, serializeLevels } from '../schemas/catalog-filters';
import type { CatalogFilters } from '../schemas/catalog-filters';

const LANG_OPTIONS = [
  { code: 'nb', endonym: 'Norsk' },
  { code: 'es', endonym: 'Español' },
  { code: 'uk', endonym: 'Українська' },
  { code: 'fr', endonym: 'Français' },
  { code: 'de', endonym: 'Deutsch' },
  { code: 'ja', endonym: '日本語' },
  { code: 'en', endonym: 'English' },
  { code: 'ru', endonym: 'Русский' },
];

/* Pill chip — used for CEFR levels */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border-[1.5px] px-3.5 py-1.75 text-[13px] font-semibold whitespace-nowrap',
        'transition-colors duration-fast',
        active
          ? 'border-(--ssz-color-primary-500) bg-(--ssz-color-primary-100) text-(--ssz-color-primary-700)'
          : 'border-(--ssz-border-default) bg-surface text-(--ssz-text-secondary) hover:border-(--ssz-border-strong)',
      )}
    >
      {children}
    </button>
  );
}

interface CatalogFilterBarProps {
  /** Total count of courses after filtering, for the result pill. */
  resultCount: number | null;
}

export function CatalogFilterBar({ resultCount }: CatalogFilterBarProps) {
  const t = useTranslations('Catalog');
  const [filters, setFilters] = useUrlFilters(catalogFiltersSchema);

  const activeLevels = parseLevels(filters.levels);

  function patch(update: Partial<CatalogFilters>) {
    setFilters(update);
  }

  function toggleLevel(lv: string) {
    const next = activeLevels.includes(lv)
      ? activeLevels.filter((x) => x !== lv)
      : [...activeLevels, lv];
    patch({ levels: serializeLevels(next) });
  }

  return (
    <div className="mb-6 flex flex-col gap-3.5">
      {/* Row 1: search + language */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-55 flex-1 basis-70">
          <Input
            placeholder={t('search')}
            value={filters.q ?? ''}
            onChange={(e) => patch({ q: e.target.value || undefined })}
            aria-label={t('search')}
          />
        </div>

        <select
          value={filters.lang ?? ''}
          onChange={(e) => patch({ lang: e.target.value || undefined })}
          className="min-w-37.5 cursor-pointer rounded-md border-[1.5px] border-(--ssz-border-default) bg-base px-3 py-2.25 text-[13.5px] font-medium text-(--ssz-text-primary) outline-none focus:border-(--ssz-border-focus)"
        >
          <option value="">
            {t('language')} · {t('all')}
          </option>
          {LANG_OPTIONS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.endonym}
            </option>
          ))}
        </select>
      </div>

      {/* Row 2: level pills + live result count */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-0.5 text-[11px] font-bold tracking-[0.06em] text-(--ssz-text-muted) uppercase">
          {t('level')}
        </span>

        {difficultyLevels.map((lv) => (
          <Chip key={lv} active={activeLevels.includes(lv)} onClick={() => toggleLevel(lv)}>
            {lv}
          </Chip>
        ))}

        {resultCount !== null && (
          <span className="ml-auto text-[13px] text-(--ssz-text-muted)" aria-live="polite" aria-atomic="true">
            <strong className="text-(--ssz-text-secondary)">{resultCount}</strong> {t('results', { count: resultCount })}
          </span>
        )}
      </div>
    </div>
  );
}
