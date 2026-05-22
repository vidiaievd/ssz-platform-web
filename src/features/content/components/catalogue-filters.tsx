'use client';

import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUrlFilters } from '@/lib/url-filters/use-url-filters';
import { containerFiltersSchema, difficultyLevels, containerTypes } from '../schemas';
import type { ContainerFilters } from '../schemas';

interface CatalogueFiltersProps {
  onFiltersChange?: (filters: Omit<ContainerFilters, 'cursor'>) => void;
}

export function CatalogueFilters({ onFiltersChange }: CatalogueFiltersProps) {
  const t = useTranslations('Content');
  const [filters, setFilters] = useUrlFilters(containerFiltersSchema);

  function patch(update: Partial<ContainerFilters>) {
    setFilters(update);
    onFiltersChange?.({ ...filters, ...update });
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Input
        placeholder={t('searchPlaceholder')}
        value={filters.search ?? ''}
        onChange={(e) => patch({ search: e.target.value || undefined })}
        className="max-w-xs"
      />

      <Select
        value={filters.targetLanguage ?? 'all'}
        onValueChange={(v) => patch({ targetLanguage: v === 'all' ? undefined : v })}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder={t('filterLanguage')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filterAll')}</SelectItem>
          <SelectItem value="no">Norsk</SelectItem>
          <SelectItem value="en">English</SelectItem>
          <SelectItem value="uk">Українська</SelectItem>
          <SelectItem value="ru">Русский</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.level ?? 'all'}
        onValueChange={(v) =>
          patch({ level: v === 'all' ? undefined : (v as ContainerFilters['level']) })
        }
      >
        <SelectTrigger className="w-28">
          <SelectValue placeholder={t('filterLevel')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filterAll')}</SelectItem>
          {difficultyLevels.map((l) => (
            <SelectItem key={l} value={l}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.type ?? 'all'}
        onValueChange={(v) =>
          patch({ type: v === 'all' ? undefined : (v as ContainerFilters['type']) })
        }
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder={t('filterType')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filterAll')}</SelectItem>
          {containerTypes.map((ct) => (
            <SelectItem key={ct} value={ct}>
              {t(`containerType.${ct}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
