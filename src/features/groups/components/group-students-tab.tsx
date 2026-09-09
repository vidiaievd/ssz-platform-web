'use client';

import { useState, useTransition, useOptimistic, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Search, UserPlus, Clock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusPill } from '@/components/ui/status-pill';
import { TableBody, TableRow, TableCell } from '@/components/ui/table';
import { removeStudent, addStudents } from '../api/mutations';
import type { RosterStudent, Group } from '../types';

type Tone = 'neutral' | 'success' | 'warning' | 'destructive';

const STUDENT_STATUS_CONFIG = {
  active:     { tone: 'success',        labelKey: 'students.status.active' },
  'at-risk':  { tone: 'warning',        labelKey: 'students.status.atRisk' },
  new:        { tone: 'accent' as Tone, labelKey: 'students.status.new' },
  finished:   { tone: 'neutral',        labelKey: 'students.status.finished' },
  clash:      { tone: 'destructive',    labelKey: 'students.status.clash' },
  unassigned: { tone: 'neutral',        labelKey: 'students.status.unassigned' },
} as const satisfies Record<RosterStudent['status'], { tone: Tone; labelKey: string }>;

type Props = {
  roster: RosterStudent[];
  group: Pick<Group, 'id' | 'capacity' | 'studentCount'>;
  schoolId: string;
  schoolSlug: string;
  addStudentsHref: string;
};

export function GroupStudentsTab({ roster, group, schoolId, schoolSlug, addStudentsHref }: Props) {
  const t = useTranslations('Groups');
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  // Optimistic removals: hide students immediately when remove is clicked.
  const [optimisticRoster, applyOptimisticRemove] = useOptimistic(
    roster,
    (current: RosterStudent[], removedId: string) =>
      current.filter((s) => s.userId !== removedId),
  );

  const filtered = query.trim()
    ? optimisticRoster.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.email.toLowerCase().includes(query.toLowerCase()),
      )
    : optimisticRoster;

  function handleRemove(student: RosterStudent) {
    setRemovingId(student.userId);
    startTransition(async () => {
      applyOptimisticRemove(student.userId);
      await removeStudent(schoolId, group.id, student.userId);
      setRemovingId(null);
      router.refresh();
      toast(t('students.removed', { name: student.name }), {
        action: {
          label: t('students.undo'),
          onClick: () => {
            startTransition(async () => {
              await addStudents(schoolId, group.id, [student.userId]);
              router.refresh();
            });
          },
        },
      });
    });
  }

  return (
    <div>
      {/* Screen-reader live region for mutation announcements */}
      <div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />

      {/* One card holds the toolbar and the roster — spec §12.5 STUDENTS TAB:
          gh-card gh-card--pad0, toolbar's own bottom border is the seam. */}
      <div className="rounded-lg border-[1.5px] border-(--ssz-border-default) bg-card overflow-hidden">
        {/* Deliberate deviation from spec §12.5 (whose toolbar sits on the
            card's own surface): a gray toolbar band, matching other tables'
            header treatment without bringing back the column labels. */}
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-subtle border-b-[1.5px] border-(--ssz-border-default)">
          <div className="relative w-60 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-(--ssz-text-muted)" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('students.search')}
              aria-label={t('students.searchAria')}
              className={cn(
                'h-9 w-full rounded-md border-[1.5px] border-(--ssz-border-default) bg-surface',
                'pl-9 pr-3 text-sm text-(--ssz-text-primary)',
                'placeholder:text-(--ssz-text-muted)',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            />
          </div>
          <Button size="sm" asChild>
            <Link href={addStudentsHref}>
              <UserPlus className="size-3.5 mr-1.5" aria-hidden="true" />
              {t('students.addStudents')}
            </Link>
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-sm text-(--ssz-text-muted)">
              {optimisticRoster.length === 0 ? t('students.noEnrolled') : t('students.noMatch')}
            </p>
            {optimisticRoster.length === 0 && (
              <Button size="sm" asChild>
                <Link href={addStudentsHref}>{t('students.addStudents')}</Link>
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            {/* No visible header — spec's roster mini-table skips it (unlike
                the groups list table, §12.4); kept for screen readers only.
                The gray band above is on the toolbar instead (deliberate
                deviation), not on a column-label row. */}
            <thead className="sr-only">
              <tr>
                <th scope="col">{t('students.columns.student')}</th>
                <th scope="col">{t('students.columns.level')}</th>
                <th scope="col">{t('students.columns.status')}</th>
                <th scope="col">{t('students.columns.progress')}</th>
                <th scope="col">{t('students.removeButton')}</th>
              </tr>
            </thead>
            <TableBody>
              {filtered.map((student) => {
                const { tone, labelKey } = STUDENT_STATUS_CONFIG[student.status];
                const isRemoving = removingId === student.userId && pending;
                return (
                  <TableRow
                    key={student.userId}
                    onClick={() => router.push(`/school/${schoolSlug}/students/${student.userId}`)}
                    className={cn('cursor-pointer', isRemoving && 'opacity-50')}
                  >
                    <TableCell className="py-2.75">
                      <div className="flex items-center gap-2.75">
                        <Avatar name={student.name} src={student.avatarUrl ?? undefined} size="sm" className="size-8" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-(--ssz-text-primary) truncate">{student.name}</p>
                          {student.email && (
                            <p className="text-[11.5px] text-(--ssz-text-muted) truncate">{student.email}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.75 hidden sm:table-cell">
                      <Badge variant="muted">{student.level}</Badge>
                    </TableCell>
                    <TableCell className="py-2.75">
                      <StatusPill tone={tone}>
                        {student.status === 'clash' && (
                          <Clock className="size-2.75 mr-1" aria-hidden="true" />
                        )}
                        {t(labelKey)}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="py-2.75 hidden md:table-cell w-35">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.25 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary-500"
                            style={{ width: `${student.progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-(--ssz-text-muted) w-8 text-right">
                          {student.progress}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.75 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(student)}
                        disabled={isRemoving}
                        aria-label={t('students.remove', { name: student.name })}
                      >
                        {t('students.removeButton')}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </table>
        )}
      </div>
    </div>
  );
}
