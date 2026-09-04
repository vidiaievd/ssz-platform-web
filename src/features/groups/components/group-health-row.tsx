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
          'inline-flex items-center rounded-full px-2.5 py-1',
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
      <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-success-700 dark:text-success-400">
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
 * The table row. Renders from 1024 up only — below that the list switches to
 * `GroupCard`, because the columns this row exists for (capacity, status) are
 * exactly the ones a narrower table has to drop (spec BEHAVIOR §10).
 */
export async function GroupHealthRow({ group, href, schoolId, schoolSlug }: Props) {
  const t = await getTranslations('Groups');
  const dangerCount = group.alerts.filter((a) => a.severity === 'danger').length;
  const label =
    dangerCount > 0
      ? `${group.name} — ${t('row.issues', { count: dangerCount })}`
      : group.name;

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        'hidden lg:grid items-center gap-x-4 px-4 py-3.5',
        'border-b border-border last:border-0',
        'transition-colors duration-100',
        'hover:bg-(--ssz-bg-subtle) focus-visible:bg-(--ssz-bg-subtle)',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        'grid-cols-[1fr_auto_auto_100px_auto_auto_56px]',
      )}
    >
      {/* Col 1 — lang + name + course/level */}
      <div className="min-w-0 flex items-center gap-3">
        <LangTile lang={group.lang} label={t('row.langLabel', { lang: group.lang })} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-(--ssz-text-primary) truncate">{group.name}</p>
          {(group.courseName || group.level) && (
            <p className="text-[11.5px] text-(--ssz-text-muted) mt-px truncate">
              {[group.courseName, group.level].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* Col 2 — teacher stack */}
      <TeacherStack
        primary={group.primaryTeacher}
        coPrimary={group.coPrimaryTeacher}
        noTeacherLabel={t('row.noTeacher')}
      />

      {/* Col 3 — schedule + mode */}
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-(--ssz-text-secondary) whitespace-nowrap">
          {group.scheduleSummary}
        </span>
        <span className="text-[11px] text-(--ssz-text-muted)">
          {group.mode === 'online' ? t('row.online') : t('row.inPerson')}
        </span>
      </div>

      {/* Col 4 — capacity meter */}
      <div className="w-[100px]">
        <CapacityMeter
          count={group.studentCount}
          min={group.capacity.min}
          max={group.capacity.max}
          size="sm"
        />
      </div>

      {/* Col 5 — status pill */}
      <GroupStatusPill status={group.status} />

      {/* Col 6 — alerts */}
      <div>
        <AlertArea alerts={group.alerts} okLabel={t('row.ok')} />
      </div>

      {/* Col 7 — row menu + chevron */}
      <div className="flex items-center gap-1 justify-end">
        <GroupRowMenu schoolId={schoolId} schoolSlug={schoolSlug} group={group} />
        <ChevronRight className="size-4 text-(--ssz-text-muted) shrink-0" aria-hidden="true" />
      </div>
    </Link>
  );
}
