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

import {
  EMPTY_FILTERS,
  isFiltering,
  type BlockStateFilter,
  type BlockTypeFilter,
  type StructureFilters,
} from '../lib/structure-filters';

interface StructureToolbarProps {
  filters: StructureFilters;
  onChange: (filters: StructureFilters) => void;
}

/**
 * Search and the two filters, above the tree.
 *
 * They narrow which *blocks* are shown and nothing else: levels and modules
 * stay put whatever is typed here, so an author never loses their place in a
 * course while looking for one exercise (BEHAVIOR.md §3, acceptance 4).
 */
export function StructureToolbar({ filters, onChange }: StructureToolbarProps) {
  const t = useTranslations('Authoring.toolbar');
  const active = isFiltering(filters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-50 flex-1">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="h-8 pl-8 text-sm"
        />
      </div>

      <Select
        value={filters.type}
        onValueChange={(type) => onChange({ ...filters, type: type as BlockTypeFilter })}
      >
        <SelectTrigger size="sm" aria-label={t('allTypes')} className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allTypes')}</SelectItem>
          <SelectItem value="vocab">{t('typeVocab')}</SelectItem>
          <SelectItem value="text">{t('typeText')}</SelectItem>
          <SelectItem value="grammar">{t('typeGrammar')}</SelectItem>
          <SelectItem value="exercises">{t('typeExercises')}</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.state}
        onValueChange={(state) => onChange({ ...filters, state: state as BlockStateFilter })}
      >
        <SelectTrigger size="sm" aria-label={t('anyState')} className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('anyState')}</SelectItem>
          <SelectItem value="published">{t('statePublished')}</SelectItem>
          <SelectItem value="edited">{t('stateEdited')}</SelectItem>
          <SelectItem value="draft">{t('stateDraft')}</SelectItem>
        </SelectContent>
      </Select>

      {active && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={13} />
          {t('clear')}
        </button>
      )}
    </div>
  );
}
