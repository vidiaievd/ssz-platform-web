'use client';

import Link from 'next/link';
import { Plus, AlertCircle, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { CapacityMeter } from '@/components/shared/operations';
import { TeacherRow } from './teacher-row';
import type { Group, Weekday } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_ORDER: Record<Weekday, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

/** Message keys for the short weekday labels — mirrors timetable-grid.tsx. */
const DAY_LABEL_KEYS = {
  Mon: 'timetable.weekdayShort.mon',
  Tue: 'timetable.weekdayShort.tue',
  Wed: 'timetable.weekdayShort.wed',
  Thu: 'timetable.weekdayShort.thu',
  Fri: 'timetable.weekdayShort.fri',
  Sat: 'timetable.weekdayShort.sat',
  Sun: 'timetable.weekdayShort.sun',
} as const satisfies Record<Weekday, string>;

function weeklyHours(slots: Group['slots']): number {
  const total = slots.reduce((acc, s) => {
    const [sh = 0, sm = 0] = s.start.split(':').map(Number);
    const [eh = 0, em = 0] = s.end.split(':').map(Number);
    return acc + (eh * 60 + em - sh * 60 - sm) / 60;
  }, 0);
  return Math.round(total * 10) / 10;
}

// ── Shared card shell ─────────────────────────────────────────────────────────

function Card({
  heading,
  sub,
  headerAction,
  children,
}: {
  heading: string;
  sub?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-bold tracking-[-0.01em] text-(--ssz-text-primary)">
            {heading}
          </h3>
          {sub && <p className="mt-0.75 text-[12.5px] text-(--ssz-text-muted)">{sub}</p>}
        </div>
        {headerAction}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// Spec: docs/design/design_handoff_group_management_hifi/Group-Management-Implementation-Spec.md §5, §12.5
// Overview = Teachers panel (primary/co/subs) + Roster summary (count + CapacityMeter + min/max) + Schedule list.
// No separate "Course" card (already summarized in the header via CourseChip and detailed in Materials) and
// no "Next lesson" projection (that generated list lives only in the dedicated Schedule tab).
type Props = {
  group: Group;
  canManage: boolean;
  schoolId: string;
  schoolSlug: string;
};

export function OverviewCards({ group, canManage, schoolId, schoolSlug }: Props) {
  const t = useTranslations('Groups');
  const detailBase = `/school/${schoolSlug}/groups/${group.id}`;

  const modeLabel = group.mode === 'online' ? t('row.online') : t('row.inPerson');
  const hours = weeklyHours(group.slots);

  const primary = group.teachers.find((gt) => gt.role === 'primary') ?? null;
  const coPrimary = group.teachers.find((gt) => gt.role === 'co-primary') ?? null;
  const substitutes = group.teachers.filter((gt) => gt.role === 'substitute');

  const sortedSlots = [...group.slots].sort(
    (a, b) => DAY_ORDER[a.day] - DAY_ORDER[b.day] || a.start.localeCompare(b.start),
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
      {/* Teachers */}
      <Card
        heading={t('overview.teachersHeading')}
        headerAction={
          canManage && (
            <Button variant="ghost" size="sm" className="h-7 px-2 -my-1" asChild>
              <Link href={`${detailBase}/assign-teacher`}>
                <Plus className="size-3.5 mr-1.5" aria-hidden="true" />
                {t('overview.assign')}
              </Link>
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-2">
          {primary ? (
            <TeacherRow teacher={primary} schoolId={schoolId} groupId={group.id} canRemove={canManage} />
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-error-200 bg-error-50 dark:border-error-800 dark:bg-error-900/20 px-4 py-3">
              <AlertCircle className="size-4 text-error-500 shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-error-700 dark:text-error-300">
                  {t('teachers.noPrimary')}
                </p>
                <p className="text-xs text-error-600/70 dark:text-error-400/70">
                  {t('teachers.noPrimaryDescription')}
                </p>
              </div>
              {canManage && (
                <Button size="sm" asChild>
                  <Link href={`${detailBase}/assign-teacher?role=primary`}>
                    {t('teachers.assignPrimary')}
                  </Link>
                </Button>
              )}
            </div>
          )}
          {coPrimary && (
            <TeacherRow teacher={coPrimary} schoolId={schoolId} groupId={group.id} canRemove={canManage} />
          )}
          {substitutes.map((s) => (
            <TeacherRow key={s.userId} teacher={s} schoolId={schoolId} groupId={group.id} canRemove={canManage} />
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        {/* Roster */}
        <Card
          heading={t('overview.rosterHeading')}
          headerAction={
            canManage && (
              <Button variant="ghost" size="sm" className="h-7 px-2 -my-1" asChild>
                <Link href={`${detailBase}/add-students`}>
                  <Plus className="size-3.5 mr-1.5" aria-hidden="true" />
                  {t('overview.add')}
                </Link>
              </Button>
            )
          }
        >
          <div className="flex items-center gap-4">
            <div className="text-[38px] font-bold leading-none tracking-[-0.03em] text-(--ssz-text-primary)">
              {group.studentCount}
              <span className="text-sm font-medium text-(--ssz-text-muted)"> /{group.capacity.max}</span>
            </div>
            <div className="flex-1">
              <CapacityMeter
                count={group.studentCount}
                min={group.capacity.min}
                max={group.capacity.max}
                hideLabel
              />
              <p className="mt-1.5 text-[11.5px] text-(--ssz-text-muted)">
                {t('overview.minMaxSeats', { min: group.capacity.min, max: group.capacity.max })}
              </p>
            </div>
          </div>
        </Card>

        {/* Schedule */}
        <Card
          heading={t('overview.scheduleHeading')}
          sub={t('overview.scheduleSummary', { hours, mode: modeLabel })}
        >
          {sortedSlots.length === 0 ? (
            <p className="text-sm text-(--ssz-text-muted) italic">{t('schedule.noSlots')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sortedSlots.map((slot, i) => (
                <div
                  key={slot.id ?? i}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400 w-8 shrink-0">
                    {t(DAY_LABEL_KEYS[slot.day])}
                  </span>
                  <span className="text-sm font-medium text-(--ssz-text-primary)">
                    {slot.start}–{slot.end}
                  </span>
                  <div className="flex-1" />
                  {slot.room && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-(--ssz-text-secondary)">
                      <MapPin className="size-3" aria-hidden="true" />
                      {slot.room}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
