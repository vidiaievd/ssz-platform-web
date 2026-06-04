import { TrendingUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { slotsOverlap } from '@/lib/groups/operations';
import { TeacherSelector } from './teacher-selector';
import { TimetableGrid } from './timetable-grid';
import type { TimetableTeacher } from '../types';

// ── Teacher header ────────────────────────────────────────────────────────────

function TeacherHeader({ teacher }: { teacher: TimetableTeacher }) {
  const { name, hours, max, overloaded, groups, conflicts } = teacher;
  const pct = max > 0 ? Math.round((hours / max) * 100) : 0;

  return (
    <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-border">
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-semibold text-(--ssz-text-primary)">{name}</h2>
        <p className="text-sm text-(--ssz-text-muted)">
          {hours.toFixed(1)}/{max}h · {groups} {groups === 1 ? 'group' : 'groups'}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {overloaded ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-error-100 dark:bg-error-900/40 text-error-700 dark:text-error-400 px-2.5 py-1 text-xs font-semibold">
            <TrendingUp className="size-3.5" aria-hidden="true" />
            Over by {(hours - max).toFixed(1)}h
          </span>
        ) : pct >= 85 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-100 dark:bg-warning-900/40 text-warning-700 dark:text-warning-400 px-2.5 py-1 text-xs font-semibold">
            <TrendingUp className="size-3.5" aria-hidden="true" />
            {pct}% load
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-100 dark:bg-success-900/40 text-success-700 dark:text-success-400 px-2.5 py-1 text-xs font-semibold">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Clear
          </span>
        )}

        {conflicts > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-error-100 dark:bg-error-900/40 text-error-700 dark:text-error-400 px-2.5 py-1 text-xs font-semibold">
            <Clock className="size-3.5" aria-hidden="true" />
            {conflicts} {conflicts === 1 ? 'clash' : 'clashes'}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Conflict list ─────────────────────────────────────────────────────────────

function ConflictList({ teacher }: { teacher: TimetableTeacher }) {
  const { lessons } = teacher;
  const pairs: Array<{ a: typeof lessons[number]; b: typeof lessons[number] }> = [];

  for (let i = 0; i < lessons.length; i++) {
    for (let j = i + 1; j < lessons.length; j++) {
      const a = lessons[i]!;
      const b = lessons[j]!;
      if (slotsOverlap(
        { day: a.day, start: a.start, end: a.end, room: '' },
        { day: b.day, start: b.start, end: b.end, room: '' },
      )) {
        pairs.push({ a, b });
      }
    }
  }

  if (pairs.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/20 p-4 space-y-2"
      role="alert"
      aria-label="Schedule conflicts"
    >
      <h3 className="text-sm font-semibold text-error-700 dark:text-error-300 flex items-center gap-1.5">
        <AlertTriangle className="size-4" aria-hidden="true" />
        {pairs.length} schedule {pairs.length === 1 ? 'conflict' : 'conflicts'}
      </h3>

      <ul className="flex flex-col gap-1.5">
        {pairs.map(({ a, b }, i) => (
          <li key={i} className="text-sm text-error-700 dark:text-error-300">
            <span className="font-medium">{a.day} clash:</span>{' '}
            <span className="font-semibold">{a.groupName}</span>{' '}
            ({a.start}–{a.end}) overlaps{' '}
            <span className="font-semibold">{b.groupName}</span>{' '}
            ({b.start}–{b.end}) — move one slot or reassign
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-(--ssz-text-muted)">
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded bg-primary-100 border border-primary-300" />
        Lesson
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded bg-muted/50 border border-dashed border-border" />
        Sub cover
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded bg-error-100 border border-error-400" />
        Conflict
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  teachers: TimetableTeacher[];
  selectedTeacherId: string | null;
  schoolSlug: string;
};

export function TeacherTimetable({ teachers, selectedTeacherId, schoolSlug }: Props) {
  const selected = teachers.find((t) => t.userId === selectedTeacherId) ?? teachers[0] ?? null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6 lg:items-start">
      {/* Workload rail */}
      <aside
        className={cn(
          'lg:w-56 xl:w-64 shrink-0',
          'rounded-lg border border-border bg-card p-3',
          'lg:sticky lg:top-6',
        )}
        aria-label="Teacher list"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-2 px-1">
          Teachers
        </h3>
        <TeacherSelector teachers={teachers} initialTeacherId={selectedTeacherId} />
      </aside>

      {/* Main area */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {selected ? (
          <>
            <TeacherHeader teacher={selected} />
            <div className="rounded-lg border border-border bg-card p-4 overflow-x-auto">
              <TimetableGrid teacher={selected} schoolSlug={schoolSlug} />
            </div>
            <ConflictList teacher={selected} />
            <Legend />
          </>
        ) : (
          <div className="flex items-center justify-center py-20 text-center">
            <p className="text-sm text-(--ssz-text-muted)">
              Select a teacher from the list to see their timetable.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
