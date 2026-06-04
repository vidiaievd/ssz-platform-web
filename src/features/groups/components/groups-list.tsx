import Link from 'next/link';
import { Users, CalendarRange } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { filterGroups, attentionCount, type GroupFilter } from '../lib/filter-groups';
import { GroupHealthRow } from './group-health-row';
import { GroupListFilters } from './group-list-filters';
import type { GroupHealthRowVM } from '../types';

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ filtered, newGroupHref }: { filtered: boolean; newGroupHref: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Users className="size-5 text-(--ssz-text-muted)" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium text-(--ssz-text-primary)">
          {filtered ? 'No groups match your filters' : 'No groups yet'}
        </p>
        <p className="mt-1 text-xs text-(--ssz-text-muted)">
          {filtered
            ? 'Try adjusting your search or filter criteria.'
            : 'Create your first group to get started.'}
        </p>
      </div>
      {!filtered && (
        <Button asChild size="sm">
          <Link href={newGroupHref}>New group</Link>
        </Button>
      )}
    </div>
  );
}

// ── Table header ──────────────────────────────────────────────────────────────

function TableHeader() {
  return (
    <div
      className={cn(
        'grid items-center gap-x-4 px-4 py-2',
        'bg-muted/40 border-b border-border',
        'text-[11px] font-semibold uppercase tracking-wide text-(--ssz-text-muted)',
        'grid-cols-[1fr_auto_20px]',
        'sm:grid-cols-[1fr_auto_auto_20px]',
        'md:grid-cols-[1fr_auto_auto_auto_20px]',
        'lg:grid-cols-[1fr_auto_auto_120px_auto_auto_20px]',
      )}
      aria-hidden="true"
    >
      <span>Group</span>
      <span className="hidden sm:block">Teacher</span>
      <span className="hidden md:block">Schedule</span>
      <span className="hidden lg:block">Capacity</span>
      <span className="hidden lg:block">Status</span>
      <span>Alerts</span>
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

export function GroupsList({ groups, schoolSlug, filter }: Props) {
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
          <h1 className="text-2xl font-bold text-(--ssz-text-primary)">Groups</h1>
          <p className="mt-0.5 text-sm text-(--ssz-text-secondary)">
            {total} {total === 1 ? 'group' : 'groups'}
            {active > 0 && <> · {active} active</>}
            {attention > 0 && (
              <>
                {' · '}
                <span className="font-semibold text-error-600 dark:text-error-400">
                  {attention} need{attention === 1 ? 's' : ''} attention
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" asChild>
            <Link href={timetableHref}>
              <CalendarRange className="size-4 mr-1.5" aria-hidden="true" />
              Teacher timetable
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={newGroupHref}>New group</Link>
          </Button>
        </div>
      </div>

      {/* Filter island (client) */}
      <GroupListFilters attentionCount={attention} draftsCount={drafts} />

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState filtered={isFiltered} newGroupHref={newGroupHref} />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <TableHeader />
          <div role="list" aria-label="Groups">
            {filtered.map((group) => (
              <div key={group.id} role="listitem">
                <GroupHealthRow
                  group={group}
                  href={`${baseHref}/groups/${group.id}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
