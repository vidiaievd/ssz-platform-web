'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Segment, SortKey } from '../lib/filter-groups';

type Props = {
  totalCount: number;
  attentionCount: number;
};

export function GroupListFilters({ totalCount, attentionCount }: Props) {
  const t = useTranslations('Groups');

  const sortLabels: Record<SortKey, string> = {
    alerts:   t('filter.sortAlerts'),
    name:     t('filter.sortName'),
    students: t('filter.sortStudents'),
  };
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const segment = (searchParams.get('segment') as Segment | null) ?? 'all';
  const sort     = (searchParams.get('sort')    as SortKey | null) ?? 'alerts';
  const q        = searchParams.get('q') ?? '';

  // Local input state so typing is instant; URL updated after debounce
  const [inputValue, setInputValue] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync if external navigation changes the URL
  useEffect(() => {
    void (async () => {
      setInputValue(searchParams.get('q') ?? '');
    })();
  }, [searchParams]);

  const updateParam = useCallback(
    (updates: Partial<Record<'q' | 'segment' | 'sort', string>>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === '' || (key === 'segment' && value === 'all') || (key === 'sort' && value === 'alerts')) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  function handleSearchChange(value: string) {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParam({ q: value }), 220);
  }

  function handleClear() {
    setInputValue('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    updateParam({ q: '' });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative w-[260px]">
        <Search
          className="absolute left-[11px] top-1/2 -translate-y-1/2 size-[15px] text-(--ssz-text-muted) pointer-events-none"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={inputValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t('filter.search')}
          aria-label={t('filter.search')}
          className="h-9 pl-[33px] pr-8"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-(--ssz-text-muted) hover:text-(--ssz-text-primary)"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Segment pills */}
      <div className="flex items-center gap-1.5" role="group" aria-label="Filter groups">
        <SegmentButton
          active={segment === 'all'}
          onClick={() => updateParam({ segment: 'all' })}
        >
          {t('filter.all')} {totalCount}
        </SegmentButton>
        <SegmentButton
          active={segment === 'attention'}
          onClick={() => updateParam({ segment: 'attention' })}
          tone="danger"
        >
          {t('filter.attention')} {attentionCount}
        </SegmentButton>
        <SegmentButton
          active={segment === 'drafts'}
          onClick={() => updateParam({ segment: 'drafts' })}
        >
          {t('filter.drafts')}
        </SegmentButton>
      </div>

      {/* Sort */}
      <div className="ml-auto flex items-center gap-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-(--ssz-text-muted)">
          {t('filter.sortLabel')}
        </span>
        <Select value={sort} onValueChange={(v) => updateParam({ sort: v })}>
          <SelectTrigger className="h-9 w-[150px] text-sm" aria-label={t('filter.sortLabel')}>
            <SelectValue>{sortLabels[sort]}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {(Object.keys(sortLabels) as SortKey[]).map((key) => (
              <SelectItem key={key} value={key}>
                {sortLabels[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ── Segment pill button ───────────────────────────────────────────────────────

function SegmentButton({
  active,
  tone = 'primary',
  onClick,
  children,
}: {
  active: boolean;
  tone?: 'primary' | 'danger';
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center rounded-full border px-[13px] py-[7px]',
        'text-[12.5px] font-semibold whitespace-nowrap transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? tone === 'danger'
            ? 'border-error-500 bg-error-50 text-error-700 dark:bg-error-900/25 dark:text-error-400'
            : 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/25 dark:text-primary-300'
          : 'border-border bg-(--ssz-bg-surface) text-(--ssz-text-secondary) hover:bg-(--ssz-bg-subtle)',
      )}
    >
      {children}
    </button>
  );
}
