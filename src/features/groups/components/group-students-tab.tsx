'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Search, UserPlus, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { CapacityMeter } from '@/components/shared/operations';
import { removeStudent, addStudents } from '../api/mutations';
import type { RosterStudent, Group } from '../types';

type Tone = 'neutral' | 'success' | 'warning' | 'destructive';

const STUDENT_STATUS_CONFIG: Record<RosterStudent['status'], { tone: Tone; label: string }> = {
  active:     { tone: 'success',     label: 'Active' },
  'at-risk':  { tone: 'warning',     label: 'At risk' },
  new:        { tone: 'accent' as Tone, label: 'New' },
  finished:   { tone: 'neutral',     label: 'Finished' },
  clash:      { tone: 'destructive', label: 'Schedule clash' },
  unassigned: { tone: 'neutral',     label: 'Unassigned' },
};

type Props = {
  roster: RosterStudent[];
  group: Pick<Group, 'id' | 'capacity' | 'studentCount'>;
  schoolId: string;
  addStudentsHref: string;
};

export function GroupStudentsTab({ roster, group, schoolId, addStudentsHref }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

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
      toast(`Removed ${student.name}`, {
        action: {
          label: 'Undo',
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
    <div className="space-y-4">
      {/* Capacity summary */}
      <div className="rounded-lg border border-border p-4 flex items-center gap-6 bg-card">
        <div className="flex-1 max-w-[200px]">
          <CapacityMeter
            count={group.studentCount}
            min={group.capacity.min}
            max={group.capacity.max}
          />
        </div>
        <p className="text-xs text-(--ssz-text-muted)">
          Min {group.capacity.min} · Max {group.capacity.max}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-(--ssz-text-muted)" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students…"
            aria-label="Search students by name or email"
            className={cn(
              'h-9 w-full rounded-md border border-input bg-background',
              'pl-8 pr-3 text-sm text-(--ssz-text-primary)',
              'placeholder:text-(--ssz-text-muted)',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          />
        </div>
        <Button size="sm" asChild>
          <a href={addStudentsHref}>
            <UserPlus className="size-3.5 mr-1.5" aria-hidden="true" />
            Add students
          </a>
        </Button>
      </div>

      {/* Roster table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm text-(--ssz-text-muted)">
            {optimisticRoster.length === 0 ? 'No students enrolled yet.' : 'No students match your search.'}
          </p>
          {optimisticRoster.length === 0 && (
            <Button size="sm" asChild>
              <a href={addStudentsHref}>Add students</a>
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm" aria-label="Student roster">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
                  Student
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-(--ssz-text-muted) hidden sm:table-cell">
                  Level
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
                  Status
                </th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-(--ssz-text-muted) hidden md:table-cell">
                  Progress
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => {
                const { tone, label } = STUDENT_STATUS_CONFIG[student.status];
                const isRemoving = removingId === student.userId && pending;
                return (
                  <tr
                    key={student.userId}
                    className={cn(
                      'border-b border-border last:border-0',
                      'hover:bg-muted/30 transition-colors',
                      isRemoving && 'opacity-50',
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={student.name} src={student.avatarUrl ?? undefined} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-(--ssz-text-primary) truncate">{student.name}</p>
                          <p className="text-xs text-(--ssz-text-muted) truncate">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="font-mono text-xs text-(--ssz-text-secondary)">{student.level}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={tone}>{label}</StatusPill>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary-500"
                            style={{ width: `${student.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-(--ssz-text-muted) w-7 text-right">
                          {student.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemove(student)}
                        disabled={isRemoving}
                        aria-label={`Remove ${student.name}`}
                        className="text-(--ssz-text-muted) hover:text-error-600"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
