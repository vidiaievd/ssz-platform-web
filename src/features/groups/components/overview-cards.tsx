import Link from 'next/link';
import { UserPlus, CalendarPlus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { CapacityMeter } from '@/components/shared/operations';
import { TeacherRow } from './teacher-row';
import { CourseChip } from './course-chip';
import type { Group, RosterStudent, Lesson, CourseView } from '../types';
import type { Alert } from '@/features/dashboard/types';

// ── Shared card shell ─────────────────────────────────────────────────────────

function Card({
  heading,
  children,
  footer,
}: {
  heading: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
        {heading}
      </h3>
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
  const detailBase = `/school/${schoolSlug}/groups/${group.id}`;

  // ── Course ──
  const modeLabel = group.mode === 'online' ? 'Online' : 'In-person';

  // ── Roster ──
  const clashCount = roster.filter((s) => s.hasClash).length;

  // ── Teachers ──
  const primary = group.teachers.find((t) => t.role === 'primary') ?? null;
  const coPrimaryCount = group.teachers.filter((t) => t.role === 'co-primary').length;
  const subCount = group.teachers.filter((t) => t.role === 'substitute').length;
  const teacherSummaryParts = [
    coPrimaryCount > 0 ? `+${coPrimaryCount} co-primary` : null,
    subCount > 0 ? `${subCount} sub${subCount > 1 ? 's' : ''}` : null,
  ].filter(Boolean);
  const noPrimaryAlert = alerts.some((a) => a.type === 'no-primary');

  // ── Next lesson ──
  const nextLesson = lessons[0] ?? null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Course */}
      <Card
        heading="Course"
        footer={<CourseChip courseView={courseView} variant="link" />}
      >
        {group.courseName ? (
          <p className="text-sm text-(--ssz-text-secondary)">
            {group.lang.toUpperCase()} · {group.courseName} · {modeLabel}
          </p>
        ) : (
          <p className="text-sm text-(--ssz-text-muted) italic">No course assigned</p>
        )}
      </Card>

      {/* Roster */}
      <Card
        heading="Roster"
        footer={<FooterLink href={`${detailBase}?tab=students`}>Manage students →</FooterLink>}
      >
        <div className="space-y-2">
          <CapacityMeter
            count={group.studentCount}
            min={group.capacity.min}
            max={group.capacity.max}
          />
          {group.studentCount === 0 ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-(--ssz-text-muted) italic">No students yet</p>
              {canManage && (
                <Link
                  href={`${detailBase}/add-students`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                >
                  <UserPlus className="size-3.5" aria-hidden="true" />
                  Add students
                </Link>
              )}
            </div>
          ) : clashCount > 0 ? (
            <p className="text-xs text-error-700 dark:text-error-400">
              {clashCount} {clashCount > 1 ? 'students' : 'student'} with a schedule clash
            </p>
          ) : null}
        </div>
      </Card>

      {/* Teachers */}
      <Card
        heading="Teachers"
        footer={<FooterLink href={`${detailBase}?tab=teachers`}>Manage teachers →</FooterLink>}
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
                No primary teacher
              </p>
              {canManage && (
                <Link
                  href={`${detailBase}/assign-teacher?role=primary`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                >
                  <UserPlus className="size-3.5" aria-hidden="true" />
                  Assign primary
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
        heading="Next lesson"
        footer={<FooterLink href={`${detailBase}?tab=schedule`}>Open schedule →</FooterLink>}
      >
        {nextLesson ? (
          <p className="text-sm text-(--ssz-text-secondary)">
            {nextLesson.date} · {nextLesson.start}–{nextLesson.end} · {nextLesson.room}
            {' · '}
            {nextLesson.teacherName}
            {nextLesson.isSubstitute && (
              <span className="ml-1 text-xs text-(--ssz-text-muted)">(sub)</span>
            )}
          </p>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-(--ssz-text-muted) italic">No upcoming lessons</p>
            {group.slots.length === 0 && canManage && (
              <Link
                href={`${detailBase}?tab=schedule`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
              >
                <CalendarPlus className="size-3.5" aria-hidden="true" />
                Add schedule →
              </Link>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
