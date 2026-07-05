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
import { discoverFilterSchema, schoolTypes } from '../schemas';
import type { DiscoverFilter } from '../schemas';

export function DiscoverFilters() {
  const t = useTranslations('Discovery');
  const [filters, setFilters] = useUrlFilters(discoverFilterSchema);

  function patch(update: Partial<DiscoverFilter>) {
    setFilters(update);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Input
        placeholder={t('searchPlaceholder')}
        value={filters.q ?? ''}
        onChange={(e) => patch({ q: e.target.value || undefined })}
        className="max-w-xs"
        aria-label={t('searchPlaceholder')}
      />

      <Select
        value={filters.type ?? 'all'}
        onValueChange={(v) =>
          patch({ type: v === 'all' ? undefined : (v as DiscoverFilter['type']) })
        }
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder={t('filterType')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filterAll')}</SelectItem>
          {schoolTypes.map((st) => (
            <SelectItem key={st} value={st}>
              {t(`schoolType.${st}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
