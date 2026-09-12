import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { ProgressBar } from '@/components/ui/progress';
import type { StudentListItem } from '@/features/students/types';

type Props = {
  student: StudentListItem;
  href: string;
  lastSeenLabel: string;
};

/**
 * The school roster row with the school out of it: a tutor has one group, so the group
 * column and the bulk-selection checkbox carry no information. What is left is the four
 * things a tutor actually reads down the column — who, at what level, how far along,
 * and when they were last here (plan 59, §4).
 */
export function TutorStudentRow({ student, href, lastSeenLabel }: Props) {
  const percent = Math.round(student.progress * 100);

  return (
    <div className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent/40">
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="truncate text-sm font-medium">{student.name}</span>
            <span className="truncate text-xs text-muted-foreground">{student.email}</span>
          </div>
          {/* On a phone the three columns below collapse into one line under the name. */}
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
            <span>{student.level}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{percent}%</span>
            <span aria-hidden>·</span>
            <span>{lastSeenLabel}</span>
          </div>
        </div>

        <div className="hidden w-10 shrink-0 text-center text-sm text-muted-foreground sm:block">
          {student.level}
        </div>

        <div className="hidden w-28 shrink-0 items-center gap-2 sm:flex">
          <ProgressBar value={percent} className="flex-1" aria-label={`Progress: ${percent}%`} />
          <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
            {percent}%
          </span>
        </div>

        <div className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground sm:block">
          {lastSeenLabel}
        </div>

        <ChevronRight className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}
