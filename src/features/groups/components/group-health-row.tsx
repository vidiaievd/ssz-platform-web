import Link from 'next/link';
import { ChevronRight, CheckCircle2, Monitor, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { AlertChip, CapacityMeter } from '@/components/shared/operations';
import { GroupStatusPill } from './group-status-pill';
import type { GroupHealthRowVM } from '../types';

// ── Lang badge ────────────────────────────────────────────────────────────────

function LangBadge({ lang }: { lang: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md px-1.5 py-0.5',
        'text-[10px] font-bold uppercase tracking-wide leading-none shrink-0',
        'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
      )}
      aria-label={`Language: ${lang}`}
    >
      {lang.slice(0, 2)}
    </span>
  );
}

// ── Teacher stack ─────────────────────────────────────────────────────────────

type TeacherInfo = { name: string; avatarUrl?: string | null } | null;

function TeacherStack({
  primary,
  coPrimary,
}: {
  primary: TeacherInfo;
  coPrimary: TeacherInfo;
}) {
  if (!primary) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
          'text-[11px] font-semibold whitespace-nowrap',
          'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-400',
        )}
      >
        <Users className="size-3" aria-hidden="true" />
        No teacher
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        <Avatar name={primary.name} src={primary.avatarUrl ?? undefined} size="sm" />
        {coPrimary && (
          <Avatar name={coPrimary.name} src={undefined} size="sm" />
        )}
      </div>
      <span className="text-sm text-(--ssz-text-secondary) truncate max-w-[140px]">
        {primary.name}
        {coPrimary && (
          <span className="text-(--ssz-text-muted)"> +1</span>
        )}
      </span>
    </div>
  );
}

// ── Alert area ────────────────────────────────────────────────────────────────

function AlertArea({ alerts }: { alerts: GroupHealthRowVM['alerts'] }) {
  if (alerts.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success-600 dark:text-success-400">
        <CheckCircle2 className="size-3" aria-hidden="true" />
        OK
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
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
};

export function GroupHealthRow({ group, href }: Props) {
  const dangerCount = group.alerts.filter((a) => a.severity === 'danger').length;

  return (
    <Link
      href={href}
      aria-label={`${group.name}${dangerCount > 0 ? ` — ${dangerCount} issue${dangerCount > 1 ? 's' : ''}` : ''}`}
      className={cn(
        'grid items-center gap-x-4 px-4 py-3.5',
        'border-b border-border last:border-0',
        'transition-colors duration-100',
        'hover:bg-muted/50 focus-visible:bg-muted/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        // Responsive columns:
        // mobile:  [name | alerts | chevron]
        // sm:      + teacher
        // md:      + schedule
        // lg:      + capacity + status
        'grid-cols-[1fr_auto_20px]',
        'sm:grid-cols-[1fr_auto_auto_20px]',
        'md:grid-cols-[1fr_auto_auto_auto_20px]',
        'lg:grid-cols-[1fr_auto_auto_120px_auto_auto_20px]',
      )}
    >
      {/* Col 1 — lang + name + course/level */}
      <div className="min-w-0 flex items-center gap-2">
        <LangBadge lang={group.lang} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-(--ssz-text-primary) truncate">{group.name}</p>
          {(group.courseName || group.level) && (
            <p className="text-xs text-(--ssz-text-muted) font-mono truncate">
              {[group.courseName, group.level].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* Col 2 — teacher stack (hidden on mobile) */}
      <div className="hidden sm:block">
        <TeacherStack primary={group.primaryTeacher} coPrimary={group.coPrimaryTeacher} />
      </div>

      {/* Col 3 — schedule + mode (hidden until md) */}
      <div className="hidden md:flex flex-col items-end gap-0.5">
        <span className="text-xs text-(--ssz-text-secondary) whitespace-nowrap">
          {group.scheduleSummary}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[10px] text-(--ssz-text-muted)">
          {group.mode === 'online' ? (
            <Monitor className="size-3" aria-hidden="true" />
          ) : null}
          {group.mode === 'online' ? 'Online' : 'In-person'}
        </span>
      </div>

      {/* Col 4 — capacity meter (hidden until lg) */}
      <div className="hidden lg:block w-[120px]">
        <CapacityMeter
          count={group.studentCount}
          min={group.capacity.min}
          max={group.capacity.max}
          size="sm"
        />
      </div>

      {/* Col 5 — status pill (hidden until lg) */}
      <div className="hidden lg:block">
        <GroupStatusPill status={group.status} />
      </div>

      {/* Col 6 — alerts (always visible) */}
      <div>
        <AlertArea alerts={group.alerts} />
      </div>

      {/* Col 7 — chevron */}
      <ChevronRight
        className="size-4 text-(--ssz-text-muted) shrink-0"
        aria-hidden="true"
      />
    </Link>
  );
}
