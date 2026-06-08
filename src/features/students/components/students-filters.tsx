'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { Search, MessageSquare, UserPlus, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { segmentPredicate, SEGMENT_KEYS } from '@/lib/students/status';
import { STATUS_META } from './status-chip';
import type { StudentListItem, SegmentKey } from '@/features/students/types';

const SEGMENT_LABELS: Record<SegmentKey, string> = {
  all: 'All',
  'at-risk': 'At risk',
  'no-group': 'No group',
  clash: 'Schedule clash',
  new: 'New',
  'multi-group': 'In 2+ groups',
  finished: 'Finished',
};

const SEGMENT_DANGER: Set<SegmentKey> = new Set(['at-risk', 'no-group', 'clash']);

type Props = {
  students: StudentListItem[];
  onBulkMessageAction?: (ids: string[]) => void;
  onBulkAddToGroupAction?: (ids: string[]) => void;
};

export function StudentsFilters({ students, onBulkMessageAction, onBulkAddToGroupAction }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const activeSegment = (searchParams.get('segment') as SegmentKey) ?? 'all';
  const search = searchParams.get('q') ?? '';

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Live counts per segment
  const counts = useMemo(
    () =>
      Object.fromEntries(
        SEGMENT_KEYS.map((key) => [key, students.filter(segmentPredicate(key)).length]),
      ) as Record<SegmentKey, number>,
    [students],
  );

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  function handleSegment(key: SegmentKey) {
    setParam('segment', key === 'all' ? null : key);
    setSelectedIds(new Set());
  }

  function handleSearch(v: string) {
    setParam('q', v || null);
  }

  const selectAll = useCallback(() => {
    const visible = students.filter((s) => {
      const pred = activeSegment !== 'all' ? segmentPredicate(activeSegment) : null;
      return pred ? pred(s) : true;
    });
    setSelectedIds(new Set(visible.map((s) => s.userId)));
  }, [students, activeSegment]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectedCount = selectedIds.size;
  const selectedArr = Array.from(selectedIds);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          placeholder="Search by name, email or group…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
          aria-label="Search students"
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => handleSearch('')}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {/* Segment pills — radiogroup */}
      <div
        role="radiogroup"
        aria-label="Filter students by segment"
        className="flex flex-wrap gap-1.5 overflow-x-auto pb-1"
      >
        {SEGMENT_KEYS.map((key) => {
          const isDanger = SEGMENT_DANGER.has(key);
          const isActive = activeSegment === key;
          const count = counts[key];
          return (
            <button
              key={key}
              role="radio"
              aria-checked={isActive}
              onClick={() => handleSegment(key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap',
                isActive
                  ? isDanger
                    ? 'border-red-400 bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                    : 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent',
              )}
            >
              {key === 'at-risk' && (
                <span aria-hidden className="text-amber-500">{STATUS_META['at-risk'].glyph}</span>
              )}
              {(key === 'no-group' || key === 'clash') && (
                <span aria-hidden className="text-red-500">
                  {key === 'no-group' ? STATUS_META.unassigned.glyph : STATUS_META.clash.glyph}
                </span>
              )}
              {SEGMENT_LABELS[key]}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                  isDanger && count > 0 ? 'bg-red-200 dark:bg-red-800' : 'bg-muted',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bulk action bar — visible when ≥1 selected */}
      {selectedCount > 0 ? (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2"
        >
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select all
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Clear
          </Button>
          <div className="ml-auto flex gap-2">
            {onBulkMessageAction && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkMessageAction(selectedArr)}
              >
                <MessageSquare className="mr-1.5 h-4 w-4" aria-hidden />
                Message
              </Button>
            )}
            {onBulkAddToGroupAction && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkAddToGroupAction(selectedArr)}
              >
                <UserPlus className="mr-1.5 h-4 w-4" aria-hidden />
                Add to group
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {/* Expose toggle/selectAll for parent via context or just return them */}
    </div>
  );
}

// Utility hook for bulk selection — used by students-list
export function useStudentBulkSelect(students: StudentListItem[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(students.map((s) => s.userId)));
  }, [students]);

  const clearAll = useCallback(() => setSelectedIds(new Set()), []);

  return { selectedIds, toggle, selectAll, clearAll };
}
