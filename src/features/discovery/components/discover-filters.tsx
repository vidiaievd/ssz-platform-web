'use client';

import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { difficultyLevels } from '@/features/content/schemas';
import { useUrlFilters } from '@/lib/url-filters/use-url-filters';
import { discoverFilterSchema, sortOptions } from '../schemas';
import type { DiscoverFilter, FormatOption } from '../schemas';

const LANGUAGE_OPTIONS = [
  { value: 'no', label: 'Norsk' },
  { value: 'en', label: 'English' },
  { value: 'uk', label: 'Українська' },
  { value: 'ru', label: 'Русский' },
] as const;

export function DiscoverFilters() {
  const t = useTranslations('Discovery');
  const [filters, setFilters] = useUrlFilters(discoverFilterSchema);

  function patch(update: Partial<DiscoverFilter>) {
    setFilters(update);
  }

  function toggleFormat(value: FormatOption) {
    patch({ format: filters.format === value ? undefined : value });
  }

  function toggleFreeIntro() {
    patch({ freeIntro: filters.freeIntro === 'true' ? undefined : 'true' });
  }

  const sortLabels: Record<string, string> = {
    recommended: t('sort.recommended'),
    rating: t('sort.rating'),
    'price-asc': t('sort.priceAsc'),
    students: t('sort.students'),
    name: t('sort.name'),
  };

  return (
    <div className="space-y-3">
      {/* Row 1: Search + Selects */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative min-w-48 flex-1 max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder={t('searchPlaceholder')}
            value={filters.q ?? ''}
            onChange={(e) => patch({ q: e.target.value || undefined })}
            className="pl-9 pr-9"
            aria-label={t('searchPlaceholder')}
          />
          {filters.q && (
            <button
              type="button"
              onClick={() => patch({ q: undefined })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Language / Subject */}
        <Select
          value={filters.language ?? 'all'}
          onValueChange={(v) => patch({ language: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-38">
            <SelectValue placeholder={t('filterLanguage')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filterLanguage')}</SelectItem>
            {LANGUAGE_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Level */}
        <Select
          value={filters.level ?? 'all'}
          onValueChange={(v) =>
            patch({ level: v === 'all' ? undefined : (v as DiscoverFilter['level']) })
          }
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder={t('filterLevel')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filterLevel')}</SelectItem>
            {difficultyLevels.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={filters.sort ?? 'recommended'}
          onValueChange={(v) =>
            patch({ sort: v === 'recommended' ? undefined : (v as DiscoverFilter['sort']) })
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('filterSort')} />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {sortLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Format chips */}
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('filterType')}>
        {(['online', 'in-person'] as const).map((fmt) => (
          <button
            key={fmt}
            type="button"
            onClick={() => toggleFormat(fmt)}
            aria-pressed={filters.format === fmt}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filters.format === fmt
                ? 'bg-primary-600 text-white'
                : 'border border-border text-(--ssz-text-secondary) hover:border-primary-300 hover:text-(--ssz-text-primary)'
            }`}
          >
            {fmt === 'online' ? t('format.online') : t('format.inPerson')}
          </button>
        ))}
        <button
          type="button"
          onClick={toggleFreeIntro}
          aria-pressed={filters.freeIntro === 'true'}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            filters.freeIntro === 'true'
              ? 'bg-primary-600 text-white'
              : 'border border-border text-(--ssz-text-secondary) hover:border-primary-300 hover:text-(--ssz-text-primary)'
          }`}
        >
          {t('format.freeIntro')}
        </button>
      </div>
    </div>
  );
}
