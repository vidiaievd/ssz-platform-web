import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ProgressBar } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from './status-chip';
import type { StudentListItem } from '@/features/students/types';

type Props = {
  student: StudentListItem;
  href: string;
  selected?: boolean;
  onSelect?: (userId: string, checked: boolean) => void;
};

function formatLastSeen(iso: string | null): string {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function StudentRow({ student, href, selected, onSelect }: Props) {
  const hasGroups = student.groups.length > 0;

  return (
    <div className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-accent/40 transition-colors">
      {/* Checkbox */}
      {onSelect && (
        <Checkbox
          checked={selected ?? false}
          onCheckedChange={(v) => onSelect(student.userId, !!v)}
          aria-label={`Select ${student.name}`}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Avatar + name/email */}
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-center gap-3"
        aria-label={`${student.name} — ${student.email}`}
      >
        <Avatar
          src={student.avatarUrl ?? undefined}
          name={student.name}
          size="md"
          className="shrink-0"
        />

        <div className="min-w-0 flex-1">
          {/* Name + email row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="truncate text-sm font-medium">{student.name}</span>
            <span className="truncate text-xs text-muted-foreground">{student.email}</span>
          </div>

          {/* Groups row — first-class column on mobile */}
          <div className="mt-1 flex flex-wrap items-center gap-1 sm:hidden">
            {hasGroups ? (
              student.groups.map((g) => (
                <Badge
                  key={g.id}
                  variant="muted"
                  className="text-xs font-normal"
                >
                  {g.lang.toUpperCase()} {g.level}
                </Badge>
              ))
            ) : (
              <Badge
                variant="muted"
                className="border-transparent bg-red-100 text-red-800 text-xs dark:bg-red-900/40 dark:text-red-300"
              >
                No group
              </Badge>
            )}
          </div>
        </div>

        {/* Groups column (desktop) */}
        <div className="hidden sm:flex w-40 lg:w-56 flex-wrap items-center gap-1">
          {hasGroups ? (
            student.groups.map((g) => (
              <Badge key={g.id} variant="muted" className="text-xs font-normal">
                {g.lang.toUpperCase()} {g.level}
              </Badge>
            ))
          ) : (
            <Badge
              variant="muted"
              className="border-transparent bg-red-100 text-red-800 text-xs dark:bg-red-900/40 dark:text-red-300"
            >
              No group
            </Badge>
          )}
        </div>

        {/* Level */}
        <div className="hidden md:block w-10 shrink-0 text-sm text-center text-muted-foreground">
          {student.level}
        </div>

        {/* Progress */}
        <div className="hidden sm:flex w-24 shrink-0 items-center gap-2">
          <ProgressBar
            value={Math.round(student.progress * 100)}
            className="flex-1"
            aria-label={`Progress: ${Math.round(student.progress * 100)}%`}
          />
          <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
            {Math.round(student.progress * 100)}%
          </span>
        </div>

        {/* Status */}
        <div className="hidden sm:block w-24 shrink-0">
          <StatusChip status={student.status} />
        </div>

        {/* Last seen */}
        <div className="hidden lg:block w-20 shrink-0 text-right text-xs text-muted-foreground">
          {formatLastSeen(student.lastSeen)}
        </div>

        <ChevronRight className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}
