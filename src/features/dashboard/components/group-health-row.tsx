import Link from 'next/link';

import { AlertChip } from './alert-chip';
import type { GroupHealth } from '../types';

type GroupHealthRowProps = {
  group: GroupHealth;
  schoolSlug: string;
};

export function GroupHealthRow({ group, schoolSlug }: GroupHealthRowProps) {
  return (
    <li className="flex items-center gap-3 py-2.5 min-w-0">
      {/* Lang badge */}
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold uppercase text-primary">
        {group.lang}
      </span>

      {/* Name + teacher/capacity */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/school/${schoolSlug}/groups/${group.id}`}
          className="block text-sm font-medium text-(--ssz-text-primary) hover:underline truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {group.name}
        </Link>
        <p className="text-xs text-(--ssz-text-muted) truncate">
          {group.primaryTeacherName
            ? `${group.primaryTeacherName} · ${group.studentCount}/${group.max} students`
            : `${group.studentCount}/${group.max} students`}
        </p>
      </div>

      {/* Alert chips (right-aligned, max 2 visible) */}
      {group.alerts.length > 0 && (
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {group.alerts.slice(0, 2).map((alert) => (
            <AlertChip key={alert.type} alert={alert} />
          ))}
        </div>
      )}
    </li>
  );
}
