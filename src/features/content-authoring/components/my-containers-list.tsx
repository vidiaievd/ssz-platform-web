'use client';

import { useCallback, useDeferredValue, useOptimistic, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Plus, Search, LayoutGrid, LayoutList, Globe, GraduationCap, BookOpen,
  Clock, X, ChevronLeft, ChevronRight, Pencil, Copy, Archive, Trash2,
} from 'lucide-react';
import { z } from 'zod/v4';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataState } from '@/components/shared/data-state';
import { Link } from '@/lib/i18n/navigation';
import { useUrlFilters } from '@/lib/url-filters/use-url-filters';
import type { Container } from '@/features/content/types';
import { useQueryClient } from '@tanstack/react-query';

import type { ContainerState, ContainerStateCounts, SchoolRole } from '../types';
import { ContainerStateBadge, deriveContainerState } from './container-state-badge';
import { useMyContainers } from '../api/use-my-containers';
import { authoringKeys } from '../api/keys';

// ─── URL filter schema ────────────────────────────────────────────────────────

const listFilterSchema = z.object({
  search:   z.string().default(''),
  state:    z.enum(['all', 'draft', 'published', 'archived']).default('all'),
  language: z.string().default(''),
  level:    z.string().default(''),
  sort:     z.enum(['recently_edited', 'name_asc']).default('recently_edited'),
  view:     z.enum(['table', 'grid']).default('table'),
  page:     z.coerce.number().int().min(1).default(1),
});
type ListFilters = z.output<typeof listFilterSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  { code: 'no', label: 'Norwegian' },
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'ru', label: 'Russian' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
];
const LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const PAGE_SIZE = 25;

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LanguageFlag({ code }: { code: string }) {
  // simple 2-letter code → emoji flag
  const emoji = code.toUpperCase().replace(/./g, (c) =>
    String.fromCodePoint(c.charCodeAt(0) + 127397),
  );
  return <span aria-hidden className="text-base leading-none">{emoji}</span>;
}

function StatePillFilter({
  state, counts, current, onClick,
}: {
  state: 'all' | ContainerState;
  counts: ContainerStateCounts & { all: number };
  current: string;
  onClick: (s: string) => void;
}) {
  const labels: Record<string, string> = { all: 'All', draft: 'Draft', published: 'Published', archived: 'Archived' };
  const countVal = counts[state as keyof typeof counts] ?? counts.all;
  const isActive = current === state;
  return (
    <button
      type="button"
      onClick={() => onClick(state)}
      className={[
        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        isActive
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
      ].join(' ')}
    >
      {labels[state]}
      <span className={isActive ? 'opacity-80' : 'opacity-60'}>{countVal}</span>
    </button>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface ContainerRowProps {
  container: Container;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  showCheckbox: boolean;
}

function ContainerTableRow({ container, selected, onSelect, showCheckbox }: ContainerRowProps) {
  const state = deriveContainerState(container);
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const containerHref = `/school/${schoolSlug}/content/${container.id}`;
  return (
    <tr
      className="group border-b border-border transition-colors hover:bg-muted/40 cursor-pointer"
      onClick={() => { window.location.href = containerHref; }}
    >
      {showCheckbox && (
        <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onSelect(container.id, !!v)}
            aria-label={`Select ${container.title}`}
          />
        </td>
      )}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <LanguageFlag code={container.targetLanguage} />
          <span className="font-medium text-sm">{container.title}</span>
        </div>
        <div className="text-muted-foreground text-xs mt-0.5 flex gap-2">
          <span className="uppercase font-mono">{container.targetLanguage}</span>
          {container.difficultyLevel && <span>·</span>}
          {container.difficultyLevel && <span>{container.difficultyLevel}</span>}
        </div>
      </td>
      <td className="px-3 py-3">
        <ContainerStateBadge state={state} />
      </td>
      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
        {container.lessonCount != null ? `${container.lessonCount}ℓ` : '—'}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {relativeTime(container.updatedAt)}
        </div>
      </td>
      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm" asChild>
          <Link href={containerHref}>
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Edit {container.title}</span>
          </Link>
        </Button>
      </td>
    </tr>
  );
}

function ContainerGridCard({ container }: { container: Container }) {
  const state = deriveContainerState(container);
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  return (
    <Link
      href={`/school/${schoolSlug}/content/${container.id}`}
      className="flex flex-col rounded-lg border border-border bg-background overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="h-16 bg-muted flex items-center justify-center text-4xl">
        <LanguageFlag code={container.targetLanguage} />
      </div>
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="flex items-start justify-between gap-1">
          <span className="text-sm font-medium leading-tight line-clamp-2">{container.title}</span>
          <ContainerStateBadge state={state} />
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground font-mono">
          <span className="uppercase">{container.targetLanguage}</span>
          {container.difficultyLevel && <><span>·</span><span>{container.difficultyLevel}</span></>}
          {container.lessonCount != null && <><span>·</span><span>{container.lessonCount}ℓ</span></>}
        </div>
      </div>
    </Link>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function ListEmptyState() {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const newHref = `/school/${schoolSlug}/content/new`;
  return (
    <div className="flex flex-col items-center gap-6 rounded-xl border-2 border-dashed border-border py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <BookOpen className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold">No courses yet</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          A course is the top-level container. Each course has CEFR levels, modules, and lessons.
          Start blank or use a template.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        <Button asChild>
          <Link href={newHref}>
            <Plus className="mr-1 h-4 w-4" />
            Create from blank
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`${newHref}?template=cefr_a1`}>
            Use CEFR A1 template
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl mt-2">
        {[
          { label: 'CEFR A1 starter', desc: '6 levels · 24 lessons', href: `${newHref}?template=cefr_a1` },
          { label: 'Conversation starter', desc: '4 modules · 12 lessons', href: `${newHref}?template=conversation` },
          { label: 'Business pack', desc: '5 modules · 20 lessons', href: `${newHref}?template=business` },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className="rounded-lg border border-border bg-muted/30 p-3 text-left hover:bg-muted transition-colors"
          >
            <p className="text-sm font-medium">{t.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-sm text-muted-foreground">No courses match this filter.</p>
      <button
        type="button"
        className="text-sm text-primary underline-offset-4 hover:underline"
        onClick={onClear}
      >
        Clear filters
      </button>
    </div>
  );
}

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ─── Bulk action bar ──────────────────────────────────────────────────────────

interface BulkBarProps {
  count: number;
  onClear: () => void;
  onArchive: () => void;
  onDuplicate: () => void;
}

function BulkActionBar({ count, onClear, onArchive, onDuplicate }: BulkBarProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
      <span className="text-sm font-medium">{count} selected</span>
      <div className="flex gap-2 ml-2">
        <Button size="sm" variant="outline" onClick={onArchive}>
          <Archive className="mr-1 h-3.5 w-3.5" />
          Archive
        </Button>
        <Button size="sm" variant="outline" onClick={onDuplicate}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          Duplicate
        </Button>
      </div>
      <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear}>
        <X className="h-3.5 w-3.5" />
        <span className="sr-only">Clear selection</span>
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface MyContainersListProps {
  schoolRole?: SchoolRole;
}

export function MyContainersList({ schoolRole = 'owner' }: MyContainersListProps) {
  const queryClient = useQueryClient();
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const newContainerHref = `/school/${schoolSlug}/content/new`;
  const [filters, setFilters] = useUrlFilters(listFilterSchema);
  const deferredSearch = useDeferredValue(filters.search);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const isOwnerOrAdmin = schoolRole === 'owner' || schoolRole === 'admin';

  const query = {
    search:   deferredSearch || undefined,
    state:    filters.state !== 'all' ? filters.state : undefined,
    language: filters.language || undefined,
    level:    filters.level || undefined,
    sort:     filters.sort,
    page:     filters.page,
    pageSize: PAGE_SIZE,
  };

  const { data, isLoading, error } = useMyContainers(query);

  const containers = data?.items ?? [];
  const total = data?.total ?? 0;
  const counts = data?.counts ?? { all: 0, draft: 0, published: 0, archived: 0 };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasActiveFilter =
    filters.search !== '' ||
    filters.state !== 'all' ||
    filters.language !== '' ||
    filters.level !== '';

  // Selection helpers
  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === containers.length ? new Set() : new Set(containers.map((c) => c.id)),
    );
  }, [containers]);

  const clearSelection = () => setSelectedIds(new Set());

  const clearFilters = () =>
    setFilters({ search: '', state: 'all', language: '', level: '' });

  // Bulk archive stub — will wire to real BFF in Step C
  const handleBulkArchive = () => {
    toast.info(`Archive ${selectedIds.size} courses — coming in next step`);
    clearSelection();
  };

  // Bulk duplicate stub
  const handleBulkDuplicate = () => {
    toast.info(`Duplicate ${selectedIds.size} courses — coming in next step`);
    clearSelection();
  };

  const invalidateList = () =>
    startTransition(() => {
      void queryClient.invalidateQueries({ queryKey: authoringKeys.containers() });
    });
  void invalidateList; // suppress unused warning — used in BFF step

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {isOwnerOrAdmin ? (
            <p className="text-sm text-muted-foreground">
              {counts.all} courses · {counts.published} published · {counts.draft} draft
              {counts.archived > 0 && ` · ${counts.archived} archived`}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              You teach {containers.length} of {counts.all} courses
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" asChild>
            <Link href={newContainerHref}>
              <Plus className="mr-1 h-4 w-4" />
              New course
            </Link>
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-45">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value, page: 1 })}
            placeholder="Search courses…"
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Language filter */}
        <Select
          value={filters.language || '_all'}
          onValueChange={(v) => setFilters({ language: v === '_all' ? '' : v, page: 1 })}
        >
          <SelectTrigger className="h-9 w-32.5">
            <Globe className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Any language</SelectItem>
            {LANGUAGE_OPTIONS.map((l) => (
              <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Level filter */}
        <Select
          value={filters.level || '_all'}
          onValueChange={(v) => setFilters({ level: v === '_all' ? '' : v, page: 1 })}
        >
          <SelectTrigger className="h-9 w-27.5">
            <GraduationCap className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Any level</SelectItem>
            {LEVEL_OPTIONS.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={filters.sort} onValueChange={(v) => setFilters({ sort: v as ListFilters['sort'], page: 1 })}>
          <SelectTrigger className="h-9 w-42.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recently_edited">Recently edited</SelectItem>
            <SelectItem value="name_asc">Name A–Z</SelectItem>
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex rounded-md border border-border overflow-hidden">
          <button
            type="button"
            aria-label="Table view"
            aria-pressed={filters.view === 'table'}
            onClick={() => setFilters({ view: 'table' })}
            className={['flex h-9 w-9 items-center justify-center transition-colors',
              filters.view === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'].join(' ')}
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={filters.view === 'grid'}
            onClick={() => setFilters({ view: 'grid' })}
            className={['flex h-9 w-9 items-center justify-center border-l border-border transition-colors',
              filters.view === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'].join(' ')}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* State filter pills */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'draft', 'published', 'archived'] as const).map((s) => (
          <StatePillFilter
            key={s}
            state={s}
            counts={counts}
            current={filters.state}
            onClick={(v) => setFilters({ state: v as ListFilters['state'], page: 1 })}
          />
        ))}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {isOwnerOrAdmin && selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          onClear={clearSelection}
          onArchive={handleBulkArchive}
          onDuplicate={handleBulkDuplicate}
        />
      )}

      {/* Body */}
      <DataState
        isLoading={isLoading}
        error={error ? { code: 'unknown' } : null}
        isEmpty={!isLoading && !error && containers.length === 0 && !hasActiveFilter}
        loadingSlot={<ListSkeleton rows={5} />}
        emptySlot={<ListEmptyState />}
      >
        {containers.length === 0 && hasActiveFilter ? (
          <FilteredEmptyState onClear={clearFilters} />
        ) : filters.view === 'grid' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {containers.map((c) => <ContainerGridCard key={c.id} container={c} />)}
            {/* "+ New" tile */}
            <Link
              href={newContainerHref}
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border min-h-30 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="h-6 w-6 mb-1" />
              <span className="text-xs font-medium">New course</span>
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full" role="table">
              <thead className="bg-muted/30">
                <tr className="border-b border-border">
                  {isOwnerOrAdmin && (
                    <th className="w-10 px-3 py-2.5">
                      <Checkbox
                        checked={selectedIds.size > 0 && selectedIds.size === containers.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </th>
                  )}
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground" scope="col">Course</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground" scope="col">State</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground" scope="col">Content</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground" scope="col">Edited</th>
                  <th className="w-12" scope="col" />
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => (
                  <ContainerTableRow
                    key={c.id}
                    container={c}
                    selected={selectedIds.has(c.id)}
                    onSelect={toggleSelect}
                    showCheckbox={isOwnerOrAdmin}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataState>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(filters.page - 1) * PAGE_SIZE + 1}–{Math.min(filters.page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page <= 1}
              onClick={() => setFilters({ page: filters.page - 1 })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= totalPages}
              onClick={() => setFilters({ page: filters.page + 1 })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
