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
import { difficultyLevels } from '@/features/content/schemas';
import { useUrlFilters } from '@/lib/url-filters/use-url-filters';
import { schoolFiltersSchema, schoolTypes } from '../schemas';
import type { SchoolFilters } from '../schemas';

export function DiscoverFilters() {
  const t = useTranslations('Discovery');
  const [filters, setFilters] = useUrlFilters(schoolFiltersSchema);

  function patch(update: Partial<SchoolFilters>) {
    setFilters(update);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Input
        placeholder={t('searchPlaceholder')}
        value={filters.search ?? ''}
        onChange={(e) => patch({ search: e.target.value || undefined })}
        className="max-w-xs"
        aria-label={t('searchPlaceholder')}
      />

      <Select
        value={filters.language ?? 'all'}
        onValueChange={(v) => patch({ language: v === 'all' ? undefined : v })}
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
          patch({ level: v === 'all' ? undefined : (v as SchoolFilters['level']) })
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
          patch({ type: v === 'all' ? undefined : (v as SchoolFilters['type']) })
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
