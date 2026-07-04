'use client';

import { useState } from 'react';

import { CheckCircle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAssignments } from '@/features/learning/api/use-assignments';
import type { Assignment } from '@/features/learning/types';

import { AssignmentRow } from './assignment-row';
import { ContinueHero } from './continue-hero';

type FilterId = 'todo' | 'submitted' | 'done' | 'all';

const FILTERS: { id: FilterId; match: (a: Assignment) => boolean }[] = [
  { id: 'todo',      match: a => ['active', 'overdue', 'returned'].includes(a.status) },
  { id: 'submitted', match: a => ['submitted', 'in-review'].includes(a.status) },
  { id: 'done',      match: a => a.status === 'completed' },
  { id: 'all',       match: () => true },
];

const PRIORITY_ORDER: Assignment['status'][] = ['returned', 'overdue', 'active', 'in-review', 'submitted'];

function pickPrimary(list: Assignment[]): Assignment | null {
  for (const st of PRIORITY_ORDER) {
    const found = list.find(a => a.status === st);
    if (found) return found;
  }
  return null;
}

/* ── Loading skeleton ─────────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-210 px-9 py-7.5 pb-16"
      aria-busy="true"
      aria-label="Loading assignments"
    >
      <Skeleton className="mb-1.5 h-3 w-20 rounded" />
      <Skeleton className="mb-1 h-8 w-48 rounded" />
      <Skeleton className="mb-6 h-4 w-64 rounded" />
      <Skeleton className="mb-6 h-26 w-full rounded-2xl" />
      <div className="flex gap-2 mb-4">
        {[80, 90, 100, 60].map((w, i) => (
          <Skeleton key={i} className="h-8 rounded-full" style={{ width: w }} />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-19 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/* ── Error state ──────────────────────────────────────────────── */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('Assignments.error');
  return (
    <div
      role="alert"
      className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 py-16 text-center"
    >
      <span
        className="flex h-16 w-16 items-center justify-center rounded-[18px]"
        style={{ background: 'var(--ssz-color-error-50)' }}
      >
        <RefreshCw size={30} style={{ color: 'var(--ssz-color-error-500)' }} aria-hidden />
      </span>
      <p className="text-[17px] font-bold" style={{ color: 'var(--ssz-text-primary)' }}>{t('title')}</p>
      <p className="max-w-sm text-sm" style={{ color: 'var(--ssz-text-secondary)' }}>{t('body')}</p>
      <Button variant="outline" onClick={onRetry} className="mt-2">
        <RefreshCw size={15} aria-hidden />
        {t('retry')}
      </Button>
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────── */
function EmptyState({ filter }: { filter: FilterId }) {
  const t = useTranslations('Assignments.empty');
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-18 px-6 text-center">
      <span
        className="mb-2.5 flex h-16 w-16 items-center justify-center rounded-[18px]"
        style={{ background: 'var(--ssz-bg-subtle)' }}
      >
        <CheckCircle size={30} style={{ color: 'var(--ssz-text-muted)' }} aria-hidden />
      </span>
      <p className="text-[17px] font-bold" style={{ color: 'var(--ssz-text-primary)' }}>{t('title')}</p>
      <p className="max-w-95 text-sm leading-relaxed" style={{ color: 'var(--ssz-text-secondary)' }}>
        {filter === 'all' ? t('bodyAll') : t('body')}
      </p>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────── */
interface AssignmentsListProps {
  courseId?: string;
}

export function AssignmentsList({ courseId }: AssignmentsListProps) {
  const t = useTranslations('Assignments');
  const locale = useLocale();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterId>('todo');

  const { data, isLoading, isError, refetch } = useAssignments(courseId);

  if (isLoading) return <LoadingSkeleton />;
  if (isError)   return <ErrorState onRetry={() => void refetch()} />;

  const assignments = data?.assignments ?? [];
  const primary = pickPrimary(assignments);
  const overdueCount = assignments.filter(a => a.status === 'overdue').length;
  const activeFilter = FILTERS.find(f => f.id === filter)!;
  const shown = assignments.filter(activeFilter.match);

  function handleOpen(a: Assignment) {
    router.push(`/${locale}/student/assignments/${a.id}`);
  }

  return (
    <div className="mx-auto w-full max-w-210 px-9 py-7.5 pb-16">
      {/* Page header */}
      <header className="mb-6">
        <p
          className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{ color: 'var(--ssz-text-muted)' }}
        >
          {t('eyebrow')}
        </p>
        <h1
          className="text-2xl font-bold tracking-[-0.02em]"
          style={{ color: 'var(--ssz-text-primary)' }}
        >
          {t('title')}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ssz-text-secondary)' }}>
          {overdueCount > 0
            ? t('subOverdue', { count: overdueCount })
            : t('subDefault')}
        </p>
      </header>

      {/* Continue hero */}
      {primary && <ContinueHero assignment={primary} onOpen={handleOpen} />}

      {/* Filter chips */}
      <div className="mb-4.5 flex flex-wrap gap-2" role="group" aria-label="Filter assignments">
        {FILTERS.map(f => {
          const count = assignments.filter(f.match).length;
          const isActive = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={isActive}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-140"
              style={{
                border: `1.5px solid ${isActive ? 'var(--ssz-color-primary-500)' : 'var(--ssz-border-default)'}`,
                background: isActive ? 'oklch(0.62 0.105 168 / 0.08)' : 'var(--ssz-bg-surface)',
                color: isActive ? 'var(--ssz-color-primary-700)' : 'var(--ssz-text-secondary)',
              }}
            >
              {t(`filter${f.id.charAt(0).toUpperCase()}${f.id.slice(1)}` as Parameters<typeof t>[0])}
              <span
                className="text-[11px] font-bold px-1.75 py-px rounded-full"
                style={{
                  background: isActive ? 'var(--ssz-color-primary-500)' : 'var(--ssz-bg-muted)',
                  color: isActive ? '#fff' : 'var(--ssz-text-muted)',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List or empty */}
      {shown.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="flex flex-col gap-2.75">
          {shown.map(a => (
            <AssignmentRow key={a.id} assignment={a} onOpen={handleOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
