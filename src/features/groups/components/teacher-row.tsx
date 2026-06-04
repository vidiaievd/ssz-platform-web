'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, TrendingUp, AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { StatusPill } from '@/components/ui/status-pill';
import { Button } from '@/components/ui/button';
import { removeTeacher } from '../api/mutations';
import type { GroupTeacher } from '../types';

type Tone = 'neutral' | 'accent' | 'success' | 'warning';

const ROLE_CONFIG: Record<GroupTeacher['role'], { tone: Tone; label: string }> = {
  primary:    { tone: 'success', label: 'Primary' },
  'co-primary': { tone: 'accent',  label: 'Co-primary' },
  substitute: { tone: 'neutral', label: 'Substitute' },
};

type Props = {
  teacher: GroupTeacher;
  schoolId: string;
  groupId: string;
  canRemove?: boolean;
  isOverloaded?: boolean;
  hasConflict?: boolean;
};

export function TeacherRow({
  teacher,
  schoolId,
  groupId,
  canRemove = false,
  isOverloaded = false,
  hasConflict = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { tone, label } = ROLE_CONFIG[teacher.role];

  function handleRemove() {
    startTransition(async () => {
      await removeTeacher(schoolId, groupId, teacher.userId);
      router.refresh();
    });
  }

  const isSubstitute = teacher.role === 'substitute';

  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2.5 px-3 rounded-lg',
        'border border-border bg-card',
        isPending && 'opacity-50',
      )}
    >
      <Avatar name={teacher.name} src={teacher.avatarUrl ?? undefined} size="sm" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-(--ssz-text-primary) truncate">
            {teacher.name}
          </span>
          <StatusPill tone={tone}>{label}</StatusPill>
          {isOverloaded && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-400">
              <TrendingUp className="size-3" aria-hidden="true" />
              Overloaded
            </span>
          )}
          {hasConflict && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-400">
              <AlertTriangle className="size-3" aria-hidden="true" />
              Conflict
            </span>
          )}
        </div>

        {isSubstitute && (teacher.from || teacher.to || teacher.reason) ? (
          <p className="mt-0.5 text-xs text-(--ssz-text-muted)">
            {[
              teacher.from && teacher.to
                ? `Covers ${teacher.from} → ${teacher.to}`
                : teacher.from
                  ? `From ${teacher.from}`
                  : teacher.to
                    ? `Until ${teacher.to}`
                    : null,
              teacher.reason,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : (
          (teacher.hours !== undefined || teacher.langs?.length) && (
            <p className="mt-0.5 text-xs text-(--ssz-text-muted)">
              {[
                teacher.hours !== undefined && teacher.max !== undefined
                  ? `${teacher.hours}/${teacher.max}h`
                  : teacher.hours !== undefined
                    ? `${teacher.hours}h`
                    : null,
                teacher.langs?.join(', '),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )
        )}
      </div>

      {canRemove && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleRemove}
          disabled={isPending}
          aria-label={`Remove ${teacher.name}`}
          className="shrink-0 text-(--ssz-text-muted) hover:text-error-600"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
