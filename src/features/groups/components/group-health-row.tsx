import Link from 'next/link';
import { ChevronRight, CheckCircle2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { AlertChip, CapacityMeter } from '@/components/shared/operations';
import { GroupStatusPill } from './group-status-pill';
import { GroupRowMenu } from './group-row-menu';
import { langTileColor } from '../lib/lang-tile-color';
import type { GroupHealthRowVM } from '../types';

// ── Language tile ─────────────────────────────────────────────────────────────

/** 38px solid tile, colored per language (spec README "Language hues"). */
export function LangTile({ lang, label }: { lang: string; label: string }) {
  return (
    <div
      className={cn(
        'flex size-[38px] shrink-0 items-center justify-center rounded-[10px]',
        'text-[15px] font-extrabold uppercase tracking-tight text-white',
        langTileColor(lang),
      )}
      aria-label={label}
    >
      {lang.slice(0, 2)}
    </div>
  );
}

// ── Teacher stack ─────────────────────────────────────────────────────────────

type TeacherInfo = { name: string; avatarUrl?: string | null } | null;

/** Avatars only, per spec — the name is what the group's own row already gives. */
export function TeacherStack({
  primary,
  coPrimary,
  noTeacherLabel,
}: {
  primary: TeacherInfo;
  coPrimary: TeacherInfo;
  noTeacherLabel: string;
}) {
  if (!primary) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-[7px] py-[2px]',
          'text-[10.5px] font-bold whitespace-nowrap',
          'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-400',
        )}
      >
        {noTeacherLabel}
      </span>
    );
  }

  return (
    <div className="flex items-center">
      <div className="ring-2 ring-(--ssz-bg-surface) rounded-full" title={primary.name}>
        <Avatar name={primary.name} src={primary.avatarUrl ?? undefined} size="sm" />
      </div>
      {coPrimary && (
        <div className="-ml-2 ring-2 ring-(--ssz-bg-surface) rounded-full" title={coPrimary.name}>
          <Avatar name={coPrimary.name} src={undefined} size="sm" />
        </div>
      )}
    </div>
  );
}

// ── Alert area ────────────────────────────────────────────────────────────────

export function AlertArea({
  alerts,
  okLabel,
}: {
  alerts: GroupHealthRowVM['alerts'];
  okLabel: string;
}) {
  if (alerts.length === 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-[9px] py-[3px]',
          'text-[11.5px] font-bold whitespace-nowrap',
          'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-400',
        )}
      >
        <CheckCircle2 className="size-3" aria-hidden="true" />
        {okLabel}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1 max-w-[175px]">
      {alerts.map((a, i) => (
        <AlertChip key={i} alert={a} />
      ))}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

type Props = {
  group: GroupHealthRowVM;
  href: string;
  schoolId: string;
  schoolSlug: string;
};

/**
 * The table row. A real `<tr>`, not an independent CSS grid: the header and
 * every row used to size their own `1fr`/`auto` tracks off their own content,
 * so columns never lined up across rows (a "Time clash" chip is wider than an
 * empty alerts cell, so column 6 landed at a different x on every row). A
 * `<table>` sizes all rows' columns together, the way the spec's own markup
 * does.
 *
 * The row still navigates on click anywhere in it: the first cell carries an
 * invisible `<Link>` stretched over the whole `<tr>` (which is why the `<tr>`
 * is `relative`), and `GroupRowMenu` in the last cell sits later in the DOM —
 * later wins the paint order at equal z-index — so it stays independently
 * clickable on top of the stretched link without needing its own z-index.
 */
export async function GroupHealthRow({ group, href, schoolId, schoolSlug }: Props) {
  const t = await getTranslations('Groups');
  const dangerCount = group.alerts.filter((a) => a.severity === 'danger').length;
  const label =
    dangerCount > 0
      ? `${group.name} — ${t('row.issues', { count: dangerCount })}`
      : group.name;

  return (
    <tr
      className={cn(
        'relative',
        'border-b border-border last:border-0',
        'transition-colors duration-100 hover:bg-(--ssz-bg-subtle)',
      )}
    >
      {/* Col 1 — lang + name + course/level, plus the stretched row link */}
      <td className="px-4 py-3.5">
        <Link
          href={href}
          aria-label={label}
          className={cn(
            'absolute inset-0',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          )}
        />
        <div className="relative min-w-0 flex items-center gap-3">
          <LangTile lang={group.lang} label={t('row.langLabel', { lang: group.lang })} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-(--ssz-text-primary) truncate">
              {group.name}
            </p>
            {(group.courseName || group.level) && (
              <p className="text-[11.5px] text-(--ssz-text-muted) mt-px truncate">
                {[group.courseName, group.level].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Col 2 — teacher stack */}
      <td className="px-4 py-3.5">
        <TeacherStack
          primary={group.primaryTeacher}
          coPrimary={group.coPrimaryTeacher}
          noTeacherLabel={t('row.noTeacher')}
        />
      </td>

      {/* Col 3 — schedule + mode */}
      <td className="px-4 py-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-(--ssz-text-secondary) whitespace-nowrap">
            {group.scheduleSummary}
          </span>
          <span className="text-[11px] text-(--ssz-text-muted)">
            {group.mode === 'online' ? t('row.online') : t('row.inPerson')}
          </span>
        </div>
      </td>

      {/* Col 4 — capacity meter */}
      <td className="px-4 py-3.5">
        <div className="w-[100px]">
          <CapacityMeter
            count={group.studentCount}
            min={group.capacity.min}
            max={group.capacity.max}
            size="sm"
          />
        </div>
      </td>

      {/* Col 5 — status pill */}
      <td className="px-4 py-3.5">
        <GroupStatusPill status={group.status} />
      </td>

      {/* Col 6 — alerts */}
      <td className="px-4 py-3.5">
        <AlertArea alerts={group.alerts} okLabel={t('row.ok')} />
      </td>

      {/* Col 7 — row menu + chevron (later in the DOM than the stretched link, so it stays clickable) */}
      <td className="px-3 py-3.5">
        <div className="relative flex items-center gap-1 justify-end">
          <GroupRowMenu schoolId={schoolId} schoolSlug={schoolSlug} group={group} />
          <ChevronRight className="size-4 text-(--ssz-text-muted) shrink-0" aria-hidden="true" />
        </div>
      </td>
    </tr>
  );
}
