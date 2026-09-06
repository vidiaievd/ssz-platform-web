'use client';

import { useDeferredValue } from 'react';
import { useParams } from 'next/navigation';
import {
  Plus,
  Search,
  LayoutGrid,
  LayoutList,
  BookOpen,
  Clock,
  X,
  ChevronLeft,
  ChevronRight,
  Pencil,
  MoreVertical,
  Eye,
  Copy,
  Archive,
  ArchiveRestore,
  Trash2,
} from 'lucide-react';
import { z } from 'zod/v4';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Segmented } from '@/components/ui/segmented';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataState } from '@/components/shared/data-state';
import { Link } from '@/lib/i18n/navigation';
import { useUrlFilters } from '@/lib/url-filters/use-url-filters';
import type { Container } from '@/features/content/types';

import type { ContainerState, SchoolRole } from '../types';
import { ContainerStateBadge, deriveContainerState } from './container-state-badge';
import { PendingChangesBadge } from './pending-changes-badge';
import { useMyContainers } from '../api/use-my-containers';

// ─── URL filter schema ────────────────────────────────────────────────────────

const listFilterSchema = z.object({
  search: z.string().default(''),
  state: z.enum(['all', 'draft', 'published', 'archived']).default('all'),
  view: z.enum(['grid', 'list']).default('grid'),
  page: z.coerce.number().int().min(1).default(1),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

// ─── Sub-components ───────────────────────────────────────────────────────────

function LanguageFlag({ code }: { code: string }) {
  // simple 2-letter code → emoji flag
  const emoji = code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397));
  return (
    <span aria-hidden className="text-base leading-none">
      {emoji}
    </span>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface ContainerRowProps {
  container: Container;
}

function ContainerTableRow({ container }: ContainerRowProps) {
  const state = deriveContainerState(container);
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const formatter = useFormatter();
  const containerHref = `/school/${schoolSlug}/content/${container.id}`;
  return (
    <TableRow className="group">
      <TableCell>
        <div className="flex items-center gap-2">
          <LanguageFlag code={container.targetLanguage} />
          <Link href={containerHref} className="font-medium text-sm hover:underline">
            {container.title}
          </Link>
        </div>
        <div className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1.5">
          <span className="uppercase font-mono">{container.targetLanguage}</span>
          <span aria-hidden>·</span>
          <Clock className="h-3 w-3" />
          {formatter.relativeTime(new Date(container.updatedAt), new Date())}
        </div>
      </TableCell>
      <TableCell>
        <CardMeta container={container} />
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1.5">
          <ContainerStateBadge state={state} />
          <PendingChangesBadge container={container} />
        </div>
      </TableCell>
      <TableCell className="text-right">
        <ContainerOverflowMenu container={container} state={state} />
      </TableCell>
    </TableRow>
  );
}

function CourseCover({ language }: { language: string }) {
  return (
    <div className="relative h-24 shrink-0 overflow-hidden rounded-t-lg bg-linear-to-br from-primary/15 via-primary/5 to-transparent">
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, var(--border) 0 10px, transparent 10px 20px)',
        }}
      />
      <span className="absolute right-2 top-2 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {language}
      </span>
      <span className="absolute bottom-1.5 left-2 text-3xl leading-none">
        <LanguageFlag code={language} />
      </span>
    </div>
  );
}

function CardMeta({ container }: { container: Container }) {
  const t = useTranslations('Authoring.structure');
  const parts = [
    container.difficultyLevel,
    container.lessonCount != null ? t('lessonCount', { count: container.lessonCount }) : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground font-mono">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>·</span>}
          {part}
        </span>
      ))}
    </div>
  );
}

// No teacher-assignment or enrollment data is exposed by the container list API yet —
// the stack always renders its empty state until that lands.
function TeacherAvatarStack() {
  const t = useTranslations('Authoring.list');
  return <span className="text-xs text-muted-foreground">{t('noTeacher')}</span>;
}

interface ContainerOverflowMenuProps {
  container: Container;
  state: ContainerState;
}

function ContainerOverflowMenu({ container, state }: ContainerOverflowMenuProps) {
  const t = useTranslations('Authoring.list');
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const containerHref = `/school/${schoolSlug}/content/${container.id}`;

  const stub = (action: string) => () => toast.info(t('itemActionStub', { action }));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={(e) => e.stopPropagation()}
          aria-label={t('moreAriaLabel', { title: container.title })}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem asChild>
          <Link href={containerHref}>
            <Pencil className="h-3.5 w-3.5" />
            {t('menuEditStructure')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={stub(t('menuPreview'))}>
          <Eye className="h-3.5 w-3.5" />
          {t('menuPreview')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={stub(t('menuDuplicate'))}>
          <Copy className="h-3.5 w-3.5" />
          {t('menuDuplicate')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {state === 'archived' ? (
          <DropdownMenuItem onSelect={stub(t('menuRestore'))}>
            <ArchiveRestore className="h-3.5 w-3.5" />
            {t('menuRestore')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={stub(t('menuArchive'))}>
            <Archive className="h-3.5 w-3.5" />
            {t('menuArchive')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onSelect={stub(t('menuDelete'))}>
          <Trash2 className="h-3.5 w-3.5" />
          {t('menuDelete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ContainerGridCard({ container }: { container: Container }) {
  const state = deriveContainerState(container);
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const containerHref = `/school/${schoolSlug}/content/${container.id}`;
  return (
    <div className="group relative flex flex-col rounded-lg border border-border bg-background overflow-hidden hover:shadow-md transition-shadow">
      <CourseCover language={container.targetLanguage} />
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-1">
          <Link
            href={containerHref}
            className="text-sm font-medium leading-tight line-clamp-2 after:absolute after:inset-0"
          >
            {container.title}
          </Link>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <ContainerStateBadge state={state} />
            <PendingChangesBadge container={container} />
          </div>
        </div>
        <CardMeta container={container} />
        <div className="relative z-1 mt-auto flex items-center justify-between gap-2 pt-1">
          <TeacherAvatarStack />
          <ContainerOverflowMenu container={container} state={state} />
        </div>
      </div>
    </div>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function ListEmptyState() {
  const t = useTranslations('Authoring.list');
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const newHref = `/school/${schoolSlug}/content/new`;
  return (
    <div className="flex flex-col items-center gap-6 rounded-xl border-2 border-dashed border-border py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <BookOpen className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold">{t('emptyTitle')}</p>
        <p className="text-sm text-muted-foreground max-w-sm">{t('emptyBody')}</p>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        <Button asChild>
          <Link href={newHref}>
            <Plus className="mr-1 h-4 w-4" />
            {t('emptyCreate')}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`${newHref}?flow=quick`}>{t('emptyTemplate')}</Link>
        </Button>
      </div>
    </div>
  );
}

interface FilteredEmptyStateProps {
  search: string;
  filterLabel?: string;
  onClear: () => void;
}

function FilteredEmptyState({ search, filterLabel, onClear }: FilteredEmptyStateProps) {
  const t = useTranslations('Authoring.list');
  const message =
    search && filterLabel
      ? t('filteredEmpty', { query: search, filter: filterLabel.toLowerCase() })
      : search
        ? t('filteredEmptySearchOnly', { query: search })
        : t('filteredEmptyStateOnly', { filter: (filterLabel ?? '').toLowerCase() });
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        className="text-sm text-primary underline-offset-4 hover:underline"
        onClick={onClear}
      >
        {t('clearFilters')}
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

// ─── Main component ───────────────────────────────────────────────────────────

interface MyContainersListProps {
  schoolRole?: SchoolRole;
}

export function MyContainersList({ schoolRole = 'owner' }: MyContainersListProps) {
  const t = useTranslations('Authoring.list');
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const newContainerHref = `/school/${schoolSlug}/content/new`;
  const [filters, setFilters] = useUrlFilters(listFilterSchema);
  const deferredSearch = useDeferredValue(filters.search);

  const isOwnerOrAdmin = schoolRole === 'owner' || schoolRole === 'admin';

  const query = {
    search: deferredSearch || undefined,
    state: filters.state !== 'all' ? filters.state : undefined,
    page: filters.page,
    pageSize: PAGE_SIZE,
  };

  const { data, isLoading, error } = useMyContainers(query);

  const containers = data?.items ?? [];
  const total = data?.total ?? 0;
  const counts = data?.counts ?? { all: 0, draft: 0, published: 0, archived: 0 };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasActiveFilter = filters.search !== '' || filters.state !== 'all';

  const clearFilters = () => setFilters({ search: '', state: 'all' });

  const statusFilterOptions = [
    { value: 'all' as const, label: t('filterAll') },
    { value: 'published' as const, label: t('filterPublished') },
    { value: 'draft' as const, label: t('filterDrafts') },
    { value: 'archived' as const, label: t('filterArchived') },
  ];

  const viewOptions = [
    { value: 'grid' as const, label: t('viewGrid'), icon: LayoutGrid },
    { value: 'list' as const, label: t('viewList'), icon: LayoutList },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {isOwnerOrAdmin ? (
            <p className="text-sm text-muted-foreground">
              {t('countsOwner', {
                all: counts.all,
                published: counts.published,
                draft: counts.draft,
              })}
              {counts.archived > 0 && t('countsArchivedSuffix', { archived: counts.archived })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('countsTeacher', { taught: containers.length, all: counts.all })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" asChild>
            <Link href={newContainerHref}>
              <Plus className="mr-1 h-4 w-4" />
              {t('newCourse')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 min-w-45 max-w-65">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value, page: 1 })}
            placeholder={t('searchPlaceholder')}
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            aria-label={t('statusFilterLabel')}
            options={statusFilterOptions}
            value={filters.state}
            onValueChange={(v) => setFilters({ state: v, page: 1 })}
          />
          <Segmented
            aria-label={t('viewToggleLabel')}
            options={viewOptions}
            value={filters.view}
            onValueChange={(v) => setFilters({ view: v })}
          />
        </div>
      </div>

      {hasActiveFilter && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
          {t('clearFilters')}
        </button>
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
          <FilteredEmptyState
            onClear={clearFilters}
            search={filters.search}
            filterLabel={
              filters.state !== 'all'
                ? statusFilterOptions.find((o) => o.value === filters.state)?.label
                : undefined
            }
          />
        ) : filters.view === 'grid' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {containers.map((c) => (
              <ContainerGridCard key={c.id} container={c} />
            ))}
            {/* "+ New" tile */}
            <Link
              href={newContainerHref}
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border min-h-30 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="h-6 w-6 mb-1" />
              <span className="text-xs font-medium">{t('newCourseTile')}</span>
            </Link>
          </div>
        ) : (
          <Table role="table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">{t('colCourse')}</TableHead>
                <TableHead scope="col">{t('colContent')}</TableHead>
                <TableHead scope="col" className="w-[200px]">
                  {t('colState')}
                </TableHead>
                <TableHead scope="col" className="w-[80px]">
                  <span className="sr-only">{t('colActions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {containers.map((c) => (
                <ContainerTableRow key={c.id} container={c} />
              ))}
            </TableBody>
          </Table>
        )}
      </DataState>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(filters.page - 1) * PAGE_SIZE + 1}–{Math.min(filters.page * PAGE_SIZE, total)}{' '}
            of {total}
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
