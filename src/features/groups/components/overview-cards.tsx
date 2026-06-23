'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserPlus, CalendarPlus, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CapacityMeter } from '@/components/shared/operations';
import { TeacherRow } from './teacher-row';
import { CourseChip } from './course-chip';
import { CourseManageDialog } from './course-manage-dialog';
import type { Group, RosterStudent, Lesson, CourseView } from '../types';
import type { Alert } from '@/features/dashboard/types';

// ── Shared card shell ─────────────────────────────────────────────────────────

function Card({
  heading,
  headerAction,
  children,
  footer,
}: {
  heading: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
          {heading}
        </h3>
        {headerAction}
      </div>
      <div className="flex-1">{children}</div>
      {footer && <div className="pt-1 border-t border-border/60">{footer}</div>}
    </section>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline underline-offset-2"
    >
      {children}
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  group: Group;
  roster: RosterStudent[];
  lessons: Lesson[];
  alerts: Alert[];
  courseView: CourseView;
  canManage: boolean;
  schoolSlug: string;
};

export function OverviewCards({
  group,
  roster,
  lessons,
  alerts,
  courseView,
  canManage,
  schoolSlug,
}: Props) {
  const t = useTranslations('Groups');
  const detailBase = `/school/${schoolSlug}/groups/${group.id}`;
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);

  // ── Course ──
  const modeLabel = group.mode === 'online' ? t('row.online') : t('row.inPerson');
  const materialsCount = group.materials.length;

  // ── Roster ──
  const clashCount = roster.filter((s) => s.hasClash).length;

  // ── Teachers ──
  const primary = group.teachers.find((gt) => gt.role === 'primary') ?? null;
  const coPrimaryCount = group.teachers.filter((gt) => gt.role === 'co-primary').length;
  const subCount = group.teachers.filter((gt) => gt.role === 'substitute').length;
  const teacherSummaryParts = [
    coPrimaryCount > 0 ? t('overview.coPrimaryCount', { count: coPrimaryCount }) : null,
    subCount > 0
      ? subCount > 1
        ? t('overview.subCountPlural', { count: subCount })
        : t('overview.subCount', { count: subCount })
      : null,
  ].filter(Boolean);
  const noPrimaryAlert = alerts.some((a) => a.type === 'no-primary');

  // ── Next lesson ──
  const nextLesson = lessons[0] ?? null;

  return (
    <>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Course */}
      <Card
        heading={t('overview.courseHeading')}
        headerAction={canManage && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 -my-1"
            onClick={() => setCourseDialogOpen(true)}
          >
            <Pencil className="size-3.5 mr-1.5" aria-hidden="true" />
            {t('course.manage')}
          </Button>
        )}
        footer={<CourseChip courseView={courseView} canManage={canManage} materials={group.materials} variant="link" />}
      >
        <div className="space-y-1">
          {group.courseName ? (
            <p className="text-sm text-(--ssz-text-secondary)">
              {group.lang.toUpperCase()} · {group.courseName} · {modeLabel}
            </p>
          ) : (
            <p className="text-sm text-(--ssz-text-muted) italic">{t('course.noCourse')}</p>
          )}
          {materialsCount > 0 && (
            <p className="text-xs text-(--ssz-text-muted)">
              {materialsCount > 1
                ? t('course.materialsCountPlural', { count: materialsCount })
                : t('course.materialsCount', { count: materialsCount })}
            </p>
          )}
        </div>
      </Card>

      {/* Roster */}
      <Card
        heading={t('overview.rosterHeading')}
        footer={<FooterLink href={`${detailBase}?tab=students`}>{t('overview.manageStudents')}</FooterLink>}
      >
        <div className="space-y-2">
          <CapacityMeter
            count={group.studentCount}
            min={group.capacity.min}
            max={group.capacity.max}
          />
          {group.studentCount === 0 ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-(--ssz-text-muted) italic">{t('students.noEnrolled')}</p>
              {canManage && (
                <Link
                  href={`${detailBase}/add-students`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                >
                  <UserPlus className="size-3.5" aria-hidden="true" />
                  {t('students.addStudents')}
                </Link>
              )}
            </div>
          ) : clashCount > 0 ? (
            <p className="text-xs text-error-700 dark:text-error-400">
              {clashCount > 1
                ? t('overview.clashCountPlural', { count: clashCount })
                : t('overview.clashCount', { count: clashCount })}
            </p>
          ) : null}
        </div>
      </Card>

      {/* Teachers */}
      <Card
        heading={t('overview.teachersHeading')}
        footer={<FooterLink href={`${detailBase}?tab=teachers`}>{t('overview.manageTeachers')}</FooterLink>}
      >
        <div className="space-y-2">
          {primary ? (
            <TeacherRow
              teacher={primary}
              schoolId={schoolSlug}
              groupId={group.id}
              canRemove={false}
            />
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  'text-sm font-medium',
                  noPrimaryAlert ? 'text-error-700 dark:text-error-400' : 'text-(--ssz-text-muted)',
                )}
              >
                {t('teachers.noPrimary')}
              </p>
              {canManage && (
                <Link
                  href={`${detailBase}/assign-teacher?role=primary`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                >
                  <UserPlus className="size-3.5" aria-hidden="true" />
                  {t('teachers.assignPrimary')}
                </Link>
              )}
            </div>
          )}
          {teacherSummaryParts.length > 0 && (
            <p className="text-xs text-(--ssz-text-muted)">{teacherSummaryParts.join(' · ')}</p>
          )}
        </div>
      </Card>

      {/* Next lesson */}
      <Card
        heading={t('overview.nextLessonHeading')}
        footer={<FooterLink href={`${detailBase}?tab=schedule`}>{t('overview.openSchedule')}</FooterLink>}
      >
        {nextLesson ? (
          <p className="text-sm text-(--ssz-text-secondary)">
            {nextLesson.date} · {nextLesson.start}–{nextLesson.end} · {nextLesson.room}
            {' · '}
            {nextLesson.teacherName}
            {nextLesson.isSubstitute && (
              <span className="ml-1 text-xs text-(--ssz-text-muted)">({t('schedule.sub')})</span>
            )}
          </p>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-(--ssz-text-muted) italic">{t('schedule.noLessons')}</p>
            {group.slots.length === 0 && canManage && (
              <Link
                href={`${detailBase}?tab=schedule`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
              >
                <CalendarPlus className="size-3.5" aria-hidden="true" />
                {t('overview.addSchedule')}
              </Link>
            )}
          </div>
        )}
      </Card>
    </div>
      {canManage && (
        <CourseManageDialog
          group={group}
          schoolId={schoolSlug}
          open={courseDialogOpen}
          onOpenChange={setCourseDialogOpen}
        />
      )}
    </>
  );
}
