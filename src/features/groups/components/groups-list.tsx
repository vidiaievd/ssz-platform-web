import Link from 'next/link';
import { Users, CalendarRange } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { filterGroups, attentionCount, type GroupFilter } from '../lib/filter-groups';
import { GroupHealthRow } from './group-health-row';
import { GroupCard } from './group-card';
import { GroupListFilters } from './group-list-filters';
import type { GroupHealthRowVM } from '../types';

// ── Empty state ───────────────────────────────────────────────────────────────

async function EmptyState({ filtered, newGroupHref }: { filtered: boolean; newGroupHref: string }) {
  const t = await getTranslations('Groups');

  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Users className="size-5 text-(--ssz-text-muted)" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium text-(--ssz-text-primary)">
          {filtered ? t('list.filteredEmpty') : t('list.empty.title')}
        </p>
        {!filtered && (
          <p className="mt-1 text-xs text-(--ssz-text-muted)">{t('list.empty.description')}</p>
        )}
      </div>
      {!filtered && (
        <Button asChild size="sm">
          <Link href={newGroupHref}>{t('list.empty.action')}</Link>
        </Button>
      )}
    </div>
  );
}

// ── KPI strip ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-2xl font-bold leading-none',
          tone === 'danger' && value > 0
            ? 'text-error-600 dark:text-error-400'
            : 'text-(--ssz-text-primary)',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-(--ssz-text-muted)">{hint}</p>}
    </div>
  );
}

async function KpiStrip({ groups }: { groups: GroupHealthRowVM[] }) {
  const t = await getTranslations('Groups');

  const active = groups.filter((g) => g.status === 'active').length;
  const attention = attentionCount(groups);
  const students = groups.reduce((sum, g) => sum + g.studentCount, 0);
  const drafts = groups.filter((g) => g.status === 'draft').length;
  const needTeacher = groups.filter((g) =>
    g.alerts.some((a) => a.type === 'no-primary'),
  ).length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-3.5">
      <KpiCard
        label={t('list.kpi.activeGroups')}
        value={active}
        hint={t('list.kpi.needTeacher', { count: needTeacher })}
      />
      <KpiCard
        label={t('list.kpi.needAttention')}
        value={attention}
        tone="danger"
        hint={attention === 0 ? t('list.kpi.allClear') : undefined}
      />
      <KpiCard label={t('list.kpi.studentsEnrolled')} value={students} />
      <KpiCard label={t('list.kpi.drafts')} value={drafts} />
    </div>
  );
}

// ── Table header ──────────────────────────────────────────────────────────────

async function TableHeader() {
  const t = await getTranslations('Groups');

  return (
    <div
      className={cn(
        'hidden lg:grid items-center gap-x-4 px-4 py-2',
        'bg-muted/40 border-b border-border',
        'text-[11px] font-semibold uppercase tracking-wide text-(--ssz-text-muted)',
        'grid-cols-[1fr_auto_auto_120px_auto_auto_20px]',
      )}
      aria-hidden="true"
    >
      <span>{t('list.columns.group')}</span>
      <span>{t('list.columns.teacher')}</span>
      <span>{t('list.columns.schedule')}</span>
      <span>{t('list.columns.capacity')}</span>
      <span>{t('list.columns.status')}</span>
      <span>{t('list.columns.alerts')}</span>
      <span />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  groups: GroupHealthRowVM[];
  schoolSlug: string;
  filter: GroupFilter;
};

export async function GroupsList({ groups, schoolSlug, filter }: Props) {
  const t = await getTranslations('Groups');
  const baseHref = `/school/${schoolSlug}`;
  const newGroupHref = `${baseHref}/groups/new`;
  const timetableHref = `${baseHref}/groups/timetable`;

  const total      = groups.length;
  const active     = groups.filter((g) => g.status === 'active').length;
  const attention  = attentionCount(groups);
  const drafts     = groups.filter((g) => g.status === 'draft').length;
  const filtered   = filterGroups(groups, filter);
  const isFiltered = Boolean(filter.q || (filter.segment && filter.segment !== 'all'));

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-(--ssz-text-primary)">{t('list.title')}</h1>
          <p className="mt-0.5 text-sm text-(--ssz-text-secondary)">
            {t('list.count', { count: total })}
            {active > 0 && <> · {active} {t('list.active')}</>}
            {attention > 0 && (
              <>
                {' · '}
                <span className="font-semibold text-error-600 dark:text-error-400">
                  {attention} {attention === 1 ? t('list.attentionSingular') : t('list.attention')}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" asChild>
            <Link href={timetableHref}>
              <CalendarRange className="size-4 mr-1.5" aria-hidden="true" />
              {t('list.timetable')}
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={newGroupHref}>{t('list.newGroup')}</Link>
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      {total > 0 && <KpiStrip groups={groups} />}

      {/* Filter island (client) */}
      <GroupListFilters attentionCount={attention} draftsCount={drafts} />

      {/* Table (≥1024) / cards (below) */}
      {filtered.length === 0 ? (
        <EmptyState filtered={isFiltered} newGroupHref={newGroupHref} />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <TableHeader />
          <div role="list" aria-label={t('list.title')}>
            {filtered.map((group) => (
              <div key={group.id} role="listitem">
                <GroupHealthRow group={group} href={`${baseHref}/groups/${group.id}`} />
                <GroupCard group={group} href={`${baseHref}/groups/${group.id}`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
