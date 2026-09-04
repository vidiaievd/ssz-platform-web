import Link from 'next/link';
import { Users, CalendarRange, Plus } from 'lucide-react';
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
  hint: string;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-semibold text-(--ssz-text-muted)">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-[26px] font-bold leading-[1.1] tracking-tight',
          tone === 'danger' && value > 0
            ? 'text-error-600 dark:text-error-400'
            : 'text-(--ssz-text-primary)',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-(--ssz-text-muted)">{hint}</p>
    </div>
  );
}

async function KpiStrip({ groups }: { groups: GroupHealthRowVM[] }) {
  const t = await getTranslations('Groups');

  const active = groups.filter((g) => g.status === 'active').length;
  const attention = attentionCount(groups);
  const students = groups.reduce((sum, g) => sum + g.studentCount, 0);
  const drafts = groups.filter((g) => g.status === 'draft').length;
  const needTeacher = groups.filter((g) => g.alerts.some((a) => a.type === 'no-primary')).length;

  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      <KpiCard
        label={t('list.kpi.activeGroups')}
        value={active}
        hint={t('list.kpi.needTeacher', { count: needTeacher })}
      />
      <KpiCard
        label={t('list.kpi.needAttention')}
        value={attention}
        tone="danger"
        hint={t('list.kpi.attentionHint')}
      />
      <KpiCard
        label={t('list.kpi.studentsEnrolled')}
        value={students}
        hint={t('list.kpi.studentsHint')}
      />
      <KpiCard label={t('list.kpi.drafts')} value={drafts} hint={t('list.kpi.draftsHint')} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  groups: GroupHealthRowVM[];
  schoolId: string;
  schoolSlug: string;
  filter: GroupFilter;
};

export async function GroupsList({ groups, schoolId, schoolSlug, filter }: Props) {
  const t = await getTranslations('Groups');
  const baseHref = `/school/${schoolSlug}`;
  const newGroupHref = `${baseHref}/groups/new`;
  const timetableHref = `${baseHref}/groups/timetable`;

  const total = groups.length;
  const active = groups.filter((g) => g.status === 'active').length;
  const attention = attentionCount(groups);
  const filtered = filterGroups(groups, filter);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[27px] font-bold text-(--ssz-text-primary) tracking-tight">
            {t('list.title')}
          </h1>
          <p className="mt-[5px] text-sm text-(--ssz-text-secondary)">
            {t('list.count', { count: total })} · {active} {t('list.active')} ·{' '}
            <span
              className={cn(attention > 0 && 'font-semibold text-error-600 dark:text-error-400')}
            >
              {attention} {t('list.attention')}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button variant="ghost" size="sm" asChild>
            <Link href={timetableHref}>
              <CalendarRange className="size-4 mr-1.5" aria-hidden="true" />
              {t('list.timetable')}
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={newGroupHref}>
              <Plus className="size-4 mr-1.5" aria-hidden="true" />
              {t('list.newGroup')}
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      {total > 0 && <KpiStrip groups={groups} />}

      {/* Filter island (client) */}
      {total > 0 && <GroupListFilters totalCount={total} attentionCount={attention} />}

      {/* Table (≥1024) / cards (below) */}
      {total === 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <EmptyState filtered={false} newGroupHref={newGroupHref} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <p className="py-10 text-center text-sm text-(--ssz-text-muted)">
            {t('list.filteredEmpty')}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: a real table, so every row's columns line up with the
              header and with each other — a CSS grid per row cannot promise
              that, since each row's own content sizes its own tracks. */}
          <div className="hidden lg:block rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="bg-(--ssz-bg-subtle) border-b border-border">
                    <th
                      className={cn(
                        'text-left px-4 py-[11px] text-[10.5px] font-bold uppercase tracking-wide',
                        'text-(--ssz-text-muted)',
                      )}
                    >
                      {t('list.columns.group')}
                    </th>
                    <th className="text-left px-4 py-[11px] text-[10.5px] font-bold uppercase tracking-wide text-(--ssz-text-muted)">
                      {t('list.columns.teacher')}
                    </th>
                    <th className="text-left px-4 py-[11px] text-[10.5px] font-bold uppercase tracking-wide text-(--ssz-text-muted)">
                      {t('list.columns.schedule')}
                    </th>
                    <th className="text-left px-4 py-[11px] text-[10.5px] font-bold uppercase tracking-wide text-(--ssz-text-muted)">
                      {t('list.columns.capacity')}
                    </th>
                    <th className="text-left px-4 py-[11px] text-[10.5px] font-bold uppercase tracking-wide text-(--ssz-text-muted)">
                      {t('list.columns.status')}
                    </th>
                    <th className="text-left px-4 py-[11px] text-[10.5px] font-bold uppercase tracking-wide text-(--ssz-text-muted)">
                      {t('list.columns.alerts')}
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((group) => (
                    <GroupHealthRow
                      key={group.id}
                      group={group}
                      href={`${baseHref}/groups/${group.id}`}
                      schoolId={schoolId}
                      schoolSlug={schoolSlug}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Below 1024: cards, not a narrowed table (spec BEHAVIOR §10's
              intermediate step drops capacity + status — the two facts this
              list exists to show — so the card keeps all six instead). */}
          <div className="lg:hidden rounded-lg border border-border overflow-hidden">
            {filtered.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                href={`${baseHref}/groups/${group.id}`}
                schoolId={schoolId}
                schoolSlug={schoolSlug}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
