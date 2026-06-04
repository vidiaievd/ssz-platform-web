'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, X, ArrowDownUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Segment, SortKey } from '../lib/filter-groups';

type Props = {
  attentionCount: number;
  draftsCount: number;
};

const SORT_LABELS: Record<SortKey, string> = {
  alerts:   'Most alerts',
  name:     'Name A–Z',
  students: 'Most students',
};

export function GroupListFilters({ attentionCount, draftsCount }: Props) {
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
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-(--ssz-text-muted)"
          aria-hidden="true"
        />
        <input
          type="search"
          value={inputValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search groups…"
          aria-label="Search groups by name, course, or teacher"
          className={cn(
            'h-9 w-52 rounded-md border border-input bg-background',
            'pl-8 pr-8 text-sm text-(--ssz-text-primary)',
            'placeholder:text-(--ssz-text-muted)',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
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
      <div className="flex items-center gap-1" role="group" aria-label="Filter groups">
        <SegmentButton
          active={segment === 'all'}
          onClick={() => updateParam({ segment: 'all' })}
        >
          All
        </SegmentButton>
        <SegmentButton
          active={segment === 'attention'}
          onClick={() => updateParam({ segment: 'attention' })}
          danger={attentionCount > 0}
        >
          Needs attention
          {attentionCount > 0 && (
            <span className={cn(
              'ml-1 inline-flex items-center justify-center rounded-full px-1.5 min-w-[18px] h-[18px]',
              'text-[10px] font-bold leading-none',
              segment === 'attention'
                ? 'bg-error-700 text-white dark:bg-error-600'
                : 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-400',
            )}>
              {attentionCount}
            </span>
          )}
        </SegmentButton>
        <SegmentButton
          active={segment === 'drafts'}
          onClick={() => updateParam({ segment: 'drafts' })}
        >
          Drafts
          {draftsCount > 0 && (
            <span className={cn(
              'ml-1 inline-flex items-center justify-center rounded-full px-1.5 min-w-[18px] h-[18px]',
              'text-[10px] font-bold leading-none',
              segment === 'drafts'
                ? 'bg-primary-700 text-white dark:bg-primary-600'
                : 'bg-muted text-(--ssz-text-muted)',
            )}>
              {draftsCount}
            </span>
          )}
        </SegmentButton>
      </div>

      {/* Sort */}
      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-(--ssz-text-secondary)">
              <ArrowDownUp className="size-3.5" aria-hidden="true" />
              {SORT_LABELS[sort]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <DropdownMenuItem
                key={key}
                onClick={() => updateParam({ sort: key })}
                className={sort === key ? 'font-semibold' : ''}
              >
                {SORT_LABELS[key]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── Segment pill button ───────────────────────────────────────────────────────

function SegmentButton({
  active,
  danger,
  onClick,
  children,
}: {
  active: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? danger
            ? 'bg-error-600 text-white dark:bg-error-700'
            : 'bg-primary-600 text-white dark:bg-primary-700'
          : 'bg-muted text-(--ssz-text-secondary) hover:bg-muted/80',
      )}
    >
      {children}
    </button>
  );
}
