import Link from 'next/link';
import { Users, CalendarRange, Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead } from '@/components/ui/table';
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
          {/* Desktop: the shared Table primitive, not hand-rolled markup — every
              row's columns line up with the header and with each other because
              table-layout:fixed sizes columns once, from these <TableHead>
              widths, instead of every row negotiating its own. */}
          <div className="hidden lg:block">
            <Table className="min-w-[900px] table-fixed">
              <TableHeader>
                {/* The header/body divider itself lives on TableHead, not here
                    — see the comment there for why a row-level border doesn't
                    survive border-collapse. */}
                <TableRow className="hover:bg-transparent">
                  {/* Explicit, not left to soak up the rest: an unset column
                      under table-fixed takes 100% of whatever the other six
                      don't use, and on a wide page with short names that's a
                      few hundred empty pixels between the name and Teachers
                      — reading as "Teachers is oddly far away" rather than
                      "Group is generous". Every column specified means any
                      leftover width is spread proportionally across all
                      seven instead of dumped into one. */}
                  <TableHead className="w-[400px]">{t('list.columns.group')}</TableHead>
                  <TableHead className="w-[90px]">{t('list.columns.teacher')}</TableHead>
                  <TableHead className="w-[160px]">{t('list.columns.schedule')}</TableHead>
                  <TableHead className="w-[130px]">{t('list.columns.capacity')}</TableHead>
                  <TableHead className="w-[100px]">{t('list.columns.status')}</TableHead>
                  <TableHead className="w-[150px]">{t('list.columns.alerts')}</TableHead>
                  {/* 80, not 64: the menu button (28px) + chevron (16px) + gap
                      (4px) + cell padding (24px) need 72px — 64 was flex-
                      shrinking the button's width while its height held at
                      28px, which is exactly how a square button goes flat. */}
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((group) => (
                  <GroupHealthRow
                    key={group.id}
                    group={group}
                    href={`${baseHref}/groups/${group.id}`}
                    schoolId={schoolId}
                    schoolSlug={schoolSlug}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Below 1024: cards, not a narrowed table (spec BEHAVIOR §10's
              intermediate step drops capacity + status — the two facts this
              list exists to show — so the card keeps all six instead). */}
          <div className="lg:hidden rounded-lg border border-border bg-card overflow-hidden">
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
