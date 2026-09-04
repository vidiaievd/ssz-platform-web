import Link from 'next/link';
import { ChevronRight, Monitor } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { cn } from '@/lib/utils';
import { CapacityMeter } from '@/components/shared/operations';
import { GroupStatusPill } from './group-status-pill';
import { GroupRowMenu } from './group-row-menu';
import { AlertArea, LangTile, TeacherStack } from './group-health-row';
import type { GroupHealthRowVM } from '../types';

type Props = {
  group: GroupHealthRowVM;
  href: string;
  schoolId: string;
  schoolSlug: string;
};

/**
 * The list row below 1024px. Not a narrowed table: the spec's intermediate step
 * (a table with columns dropped) hides capacity and status — the two facts the
 * triage list exists to show — so the row becomes a card that keeps all six.
 */
export async function GroupCard({ group, href, schoolId, schoolSlug }: Props) {
  const t = await getTranslations('Groups');
  const dangerCount = group.alerts.filter((a) => a.severity === 'danger').length;
  const label =
    dangerCount > 0 ? `${group.name} — ${t('row.issues', { count: dangerCount })}` : group.name;

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        'lg:hidden flex flex-col gap-3 p-4 min-h-[44px]',
        'border-b border-border last:border-0',
        'transition-colors duration-100',
        'hover:bg-(--ssz-bg-subtle) focus-visible:bg-(--ssz-bg-subtle)',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
      )}
    >
      {/* Identity + status */}
      <div className="flex items-start gap-3">
        <LangTile lang={group.lang} label={t('row.langLabel', { lang: group.lang })} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-(--ssz-text-primary) truncate">{group.name}</p>
          {(group.courseName || group.level) && (
            <p className="text-[11.5px] text-(--ssz-text-muted) mt-px truncate">
              {[group.courseName, group.level].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <GroupStatusPill status={group.status} />
        <div className="flex items-center gap-1 shrink-0">
          <GroupRowMenu schoolId={schoolId} schoolSlug={schoolSlug} group={group} />
          <ChevronRight className="size-4 text-(--ssz-text-muted)" aria-hidden="true" />
        </div>
      </div>

      {/* Teacher + schedule */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <TeacherStack
          primary={group.primaryTeacher}
          coPrimary={group.coPrimaryTeacher}
          noTeacherLabel={t('row.noTeacher')}
        />
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-(--ssz-text-secondary) whitespace-nowrap">
            {group.scheduleSummary}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[10px] text-(--ssz-text-muted)">
            {group.mode === 'online' ? <Monitor className="size-3" aria-hidden="true" /> : null}
            {group.mode === 'online' ? t('row.online') : t('row.inPerson')}
          </span>
        </div>
      </div>

      {/* Capacity */}
      <CapacityMeter
        count={group.studentCount}
        min={group.capacity.min}
        max={group.capacity.max}
        size="sm"
      />

      {/* Alerts */}
      <AlertArea alerts={group.alerts} okLabel={t('row.ok')} />
    </Link>
  );
}
